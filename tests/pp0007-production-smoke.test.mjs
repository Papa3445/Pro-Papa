import test from 'node:test';
import assert from 'node:assert/strict';
import {runProductionSmoke, PRODUCTION_ORIGIN} from '../bin/pp0007-production-smoke.mjs';

const metadata = {resource:PRODUCTION_ORIGIN,
  authorization_servers:['https://example.auth0.com/'], scopes_supported:['pro_papa.read']};
const response = (payload, status=200, cache='no-store') => new Response(JSON.stringify(payload),
  {status,headers:{'Content-Type':'application/json','Cache-Control':cache}});
function denied(id) {return {jsonrpc:'2.0',id,result:{isError:true,
  content:[{type:'text',text:'Authentication required'}],
  _meta:{'mcp/www_authenticate':[
    'Bearer resource_metadata="'+PRODUCTION_ORIGIN+'/.well-known/oauth-protected-resource", scope="pro_papa.read", error="invalid_token"'
  ]}}};}
function fixture(change=()=>{}) {
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    calls.push({url,opts});
    assert.equal(opts.redirect,'error');
    assert.ok(opts.signal && typeof opts.signal.aborted === 'boolean');
    if (url.endsWith('/.well-known/oauth-protected-resource')) return change('metadata',response(metadata)) ?? response(metadata);
    assert.equal(url,PRODUCTION_ORIGIN+'/mcp');
    assert.equal(opts.method,'POST');
    const body=JSON.parse(opts.body);
    assert.equal(body.method,'tools/call');
    assert.equal(body.params.name,'pro_papa_execute_readonly');
    assert.equal(body.params.arguments.capability,'math.sum');
    assert.equal(opts.headers.Accept,'application/json, text/event-stream');
    if (body.id===701) assert.equal(opts.headers.Authorization,undefined);
    if (body.id===702) assert.equal(opts.headers.Authorization,'Bearer intentionally-invalid-test-token');
    return change('rpc'+body.id,response(denied(body.id))) ?? response(denied(body.id));
  };
  return {fetchImpl,calls};
}

test('bounded metadata and two no-credential denial requests only',async()=>{
  const f=fixture(); const out=await runProductionSmoke({fetchImpl:f.fetchImpl});
  assert.equal(out.status,'passed');
  assert.deepEqual(out.checks.map(x=>x.name),['oauth_resource_metadata','unauthenticated','malformed_token']);
  assert.equal(f.calls.length,3);
  assert.ok(f.calls.every(x=>x.url.startsWith(PRODUCTION_ORIGIN+'/')));
  assert.ok(!JSON.stringify(out).includes('example.auth0.com'));
});
test('rejects unavailable, malformed or unexpected public resource metadata',async()=>{
  for(const invalid of [response(metadata,503),response({...metadata,resource:'https://wrong.invalid'}),
    response({...metadata,authorization_servers:['http://unsafe.invalid/']}),
    response(metadata,200,'public')]) {
    await assert.rejects(()=>runProductionSmoke({fetchImpl:fixture((which)=>which==='metadata'?invalid:null).fetchImpl}));
  }
});
test('fails closed when missing authorization releases a tool result',async()=>{
  await assert.rejects(()=>runProductionSmoke({fetchImpl:fixture((which)=>
    which==='rpc701'?response({jsonrpc:'2.0',id:701,result:{isError:false,structuredContent:{total:7}}}):null).fetchImpl}),
    /unexpectedly released/);
});
test('fails closed on invalid-token response missing OAuth challenge or leaking structured output',async()=>{
  await assert.rejects(()=>runProductionSmoke({fetchImpl:fixture((which)=>
    which==='rpc702'?response({...denied(702),result:{...denied(702).result,structuredContent:{total:7}}}):null).fetchImpl}),
    /unexpectedly released/);
});
test('fails closed on wrong response status, redirect or oversized body',async()=>{
  await assert.rejects(()=>runProductionSmoke({fetchImpl:fixture((which)=>
    which==='rpc701'?response(denied(701),401):null).fetchImpl}),/HTTP 401/);
  await assert.rejects(()=>runProductionSmoke({fetchImpl:fixture((which)=>
    which==='metadata'?response(metadata,302):null).fetchImpl}),/HTTP 302/);
  const huge=Array.from({length:17000},()=> 'x').join('');
  await assert.rejects(()=>runProductionSmoke({fetchImpl:fixture((which)=>
    which==='metadata'?response({...metadata,huge}):null).fetchImpl}),/response too large/);
});
