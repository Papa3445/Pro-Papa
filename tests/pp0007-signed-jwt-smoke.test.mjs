import test from 'node:test';
import assert from 'node:assert/strict';
import {runSignedJwtSmoke} from '../bin/pp0007-signed-jwt-smoke.mjs';
import {PRODUCTION_ORIGIN} from '../bin/pp0007-production-smoke.mjs';
const issuer='https://pp-sample.auth0.com/',clientId='fake-client',clientSecret='fake-secret';
const jwt='aaa.bbb.ccc';
const inputs={clientId,clientSecret,expectedIssuer:issuer};
const json=(body,status=200)=>new Response(JSON.stringify(body),
  {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const meta={resource:PRODUCTION_ORIGIN,authorization_servers:[issuer],
  scopes_supported:['pro_papa.read']};
const token={token_type:'Bearer',expires_in:300,access_token:jwt};
const good={jsonrpc:'2.0',id:801,result:{isError:false,
  structuredContent:{status:'completed',execution:{output:{total:7,count:2}},
    trace:{state:'released',dispatchedCapability:'math.sum'}}}};
const no={jsonrpc:'2.0',id:802,result:{isError:true,
  content:[{type:'text',text:'Authentication required'}],
  _meta:{'mcp/www_authenticate':[
    'Bearer resource_metadata="'+PRODUCTION_ORIGIN+'/.well-known/oauth-protected-resource", error="invalid_token"'
  ]}}};
function fixture(change=()=>null){
  const calls=[];
  async function fetchImpl(url,opts){
    assert.equal(opts.redirect,'error');
    assert.ok(opts.signal);
    const stage=url.endsWith('/.well-known/oauth-protected-resource')?'metadata':
      url.endsWith('/oauth/token')?'token':JSON.parse(opts.body).id===801?'good':'bad';
    calls.push({url,opts,stage});
    if(stage==='token'){
      assert.equal(url,issuer+'oauth/token');
      const form=new URLSearchParams(opts.body);
      assert.equal(form.get('client_id'),clientId);
      assert.equal(form.get('client_secret'),clientSecret);
      assert.equal(form.get('audience'),PRODUCTION_ORIGIN);
      assert.equal(form.get('scope'),'pro_papa.read');
    }
    if(stage==='good')assert.equal(opts.headers.Authorization,'Bearer '+jwt);
    if(stage==='bad')assert.notEqual(opts.headers.Authorization,'Bearer '+jwt);
    return change(stage)??json(({metadata:meta,token,good,bad:no})[stage]);
  }
  return {fetchImpl,calls};
}
test('one pinned M2M exchange, one real positive result and tamper denial',async()=>{
  const f=fixture();const result=await runSignedJwtSmoke({...inputs,fetchImpl:f.fetchImpl});
  assert.equal(result.status,'passed');
  assert.deepEqual(f.calls.map(x=>x.stage),['metadata','token','good','bad']);
  assert.ok(!JSON.stringify(result).includes(clientSecret));
  assert.ok(!JSON.stringify(result).includes(issuer));
});
test('refuse missing secret or malformed issuer with zero network calls',async()=>{
  for(const update of [{clientId:''},{clientSecret:''},
    {expectedIssuer:'https://attacker.auth0.com.evil.net/'},
    {expectedIssuer:'http://pp-sample.auth0.com/'}]){
    const f=fixture();
    await assert.rejects(()=>runSignedJwtSmoke({...inputs,...update,fetchImpl:f.fetchImpl}));
    assert.equal(f.calls.length,0);
  }
});
test('metadata issuer replacement blocks credential exfiltration before token exchange',async()=>{
  const f=fixture(stage=>stage==='metadata'?
    json({...meta,authorization_servers:['https://attacker.auth0.com/']}):null);
  await assert.rejects(()=>runSignedJwtSmoke({...inputs,fetchImpl:f.fetchImpl}),
    /metadata_issuer_pin_mismatch/);
  assert.equal(f.calls.length,1);
});
test('opaque, revoked or malformed grant cannot trigger MCP calls',async()=>{
  for(const t of [json({},401),json({...token,access_token:'opaque'}),
    json({...token,expires_in:5}),json({...token,token_type:'Basic'})]){
    const f=fixture(stage=>stage==='token'?t:null);
    await assert.rejects(()=>runSignedJwtSmoke({...inputs,fetchImpl:f.fetchImpl}));
    assert.equal(f.calls.length,2);
  }
});
test('denied positive authorization is a genuine test failure',async()=>{
  const f=fixture(stage=>stage==='good'?json({...no,id:801}):null);
  await assert.rejects(()=>runSignedJwtSmoke({...inputs,fetchImpl:f.fetchImpl}),
    /valid_jwt_not_authorized/);
  assert.equal(f.calls.length,3);
});
test('a tampered signature leaking structured data fails closed',async()=>{
  const f=fixture(stage=>stage==='bad'?json({...no,result:{
    ...no.result,structuredContent:{total:7}}}):null);
  await assert.rejects(()=>runSignedJwtSmoke({...inputs,fetchImpl:f.fetchImpl}),
    /tampered_jwt_not_rejected/);
  assert.equal(f.calls.length,4);
});
test('malformed or redirected HTTP response cannot pass',async()=>{
  for(const wrong of [json(good,302),new Response('bad',{status:200,
    headers:{'Content-Type':'text/plain'}})]){
    const f=fixture(stage=>stage==='good'?wrong:null);
    await assert.rejects(()=>runSignedJwtSmoke({...inputs,fetchImpl:f.fetchImpl}));
  }
});
