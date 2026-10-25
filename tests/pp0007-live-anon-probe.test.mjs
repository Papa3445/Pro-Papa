import test from 'node:test';
import assert from 'node:assert/strict';
import {probeAnonymousMcp} from '../bin/pp0007-live-anon-probe.mjs';

const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'Content-Type':'application/json'}});
const denial=id=>({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:'Authentication required'}]}});
function fixture({bypass=false,metadataBroken=false,originAccepted=false}={}){
  const calls=[];
  const mock=async(url,request)=>{
    calls.push({url,request});
    assert.equal(url.startsWith('https://pro-papa-mcp.netlify.app/'),true);
    assert.equal(request.redirect,'error');
    if(url.endsWith('/.well-known/oauth-protected-resource'))return json({
      resource:'https://pro-papa-mcp.netlify.app',
      authorization_servers:['https://fixture.us.auth0.com/'],
      scopes_supported:metadataBroken?['all']:['pro_papa.read']});
    if(request.method==='GET')return new Response(null,{status:405});
    const message=JSON.parse(request.body);
    assert.equal(message.method,'tools/call');
    assert.equal(request.headers.Accept,'application/json, text/event-stream');
    if(request.headers.Origin)return new Response(null,{status:originAccepted?200:403});
    if(bypass&&message.id===901)return json({jsonrpc:'2.0',id:901,result:{
      isError:false,structuredContent:{status:'completed'},content:[{type:'text',text:'42'}]}});
    return json(denial(message.id));
  };
  return {mock,calls};
}
test('PP-0007 anonymous live smoke plan is bounded and passes only on denial',async()=>{
  const f=fixture();
  const result=await probeAnonymousMcp({fetchImpl:f.mock});
  assert.equal(result.status,'passed');
  assert.equal(f.calls.length,5);
  assert.equal(f.calls[2].request.headers.Authorization,undefined);
  assert.equal(f.calls[3].request.headers.Authorization,'Bearer not-a-jwt');
  assert.equal(f.calls[4].request.headers.Origin,'https://untrusted.example');
  assert.equal(result.liveAuthenticatedJwtVerified,false);
});
test('PP-0007 anonymous live probe rejects accidental tool release',async()=>{
  await assert.rejects(probeAnonymousMcp({fetchImpl:fixture({bypass:true}).mock}),
    /denial required/);
});
test('PP-0007 anonymous live probe rejects misleading metadata',async()=>{
  await assert.rejects(probeAnonymousMcp({fetchImpl:fixture({metadataBroken:true}).mock}));
});
test('PP-0007 anonymous live probe enforces origin restriction',async()=>{
  await assert.rejects(probeAnonymousMcp({fetchImpl:fixture({originAccepted:true}).mock}),
    /Cross-origin request must be denied/);
});
