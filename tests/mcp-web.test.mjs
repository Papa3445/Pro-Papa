import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadOnlyMcpWebHandler} from '../src/mcp-web.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';
import netlifyMcp from '../netlify/functions/mcp.mjs';

const KEY='very-long-fixture-token-used-for-ci-only-1234567890';
const HOST='pro-papa-mcp-example.netlify.app';
const BASE='https://'+HOST+'/mcp';
const ACCEPT='application/json, text/event-stream';
const call=(method,id,params)=>({jsonrpc:'2.0',method,id,params});
const execute=(capability,inputs,objective='Run verified read-only test')=>call('tools/call',4,{
  name:'pro_papa_execute_readonly',arguments:{capability,inputs,objective}
});
function request(payload,opts={}){
  const headers={
    Authorization:'Bearer '+KEY,Accept:ACCEPT,
    'Content-Type':'application/json',...opts.headers
  };
  return new Request(opts.url??BASE,{method:opts.method??'POST',headers,
    ...(opts.method==='GET'?{}:{body:typeof payload==='string'?payload:JSON.stringify(payload)})});
}
const handler=(opts={})=>createReadOnlyMcpWebHandler({
  bearerToken:KEY,hostname:HOST,...opts
});
const parsed=async response=>({status:response.status,
  body:response.status===202||response.status===401||response.status===405?null:
    await response.json()});

test('PP-0007 Netlify web adapter runs handshake and discovery over HTTPS Request/Response',async()=>{
  const app=handler();
  const init=await parsed(await app(request(call('initialize',1,{
    protocolVersion:'2025-11-25',clientInfo:{name:'test',version:'1'},capabilities:{}
  }))));
  assert.equal(init.status,200);
  assert.equal(init.body.result.protocolVersion,'2025-11-25');
  const prior=await parsed(await app(request(call('initialize',2,{
    protocolVersion:'2025-06-18'
  }))));
  assert.equal(prior.body.result.protocolVersion,'2025-06-18');
  const listing=await parsed(await app(request(call('tools/list',3,{}))));
  assert.equal(listing.body.result.tools.length,1);
  assert.equal(listing.body.result.tools[0].annotations.readOnlyHint,true);
  assert.equal(listing.body.result.tools[0].annotations.idempotentHint,true);
  assert.equal(listing.body.result.tools[0].inputSchema.properties.capability.enum.includes('operations'),false);
  const ping=await parsed(await app(request(call('ping',4,{}))));
  assert.deepEqual(ping.body.result,{});
  const notice=await app(request({jsonrpc:'2.0',method:'notifications/initialized'}));
  assert.equal(notice.status,202);
});

test('PP-0007 Netlify result has completed host-validated trace and checked sum',async()=>{
  const app=handler();
  const result=await parsed(await app(request(execute('math.sum',{numbers:[2,3,5]}))));
  assert.equal(result.status,200);
  assert.equal(result.body.result.isError,false);
  const outcome=result.body.result.structuredContent;
  assert.equal(outcome.execution.output.total,10);
  assert.equal(outcome.trace.scope,'single_explicit_reference_host_invocation');
  assert.equal(outcome.trace.providerAuthenticated,false);
  assert.equal(verifyReleasedExecution(outcome),true);
  assert.deepEqual(outcome.trace.events.map(e=>e.step),[
    'request.accepted','audit.not_required','route.selected',
    'handler.started','handler.returned','output.validated','response.released'
  ]);
  assert.equal(JSON.parse(result.body.result.content[0].text).status,'completed');
});

test('PP-0007 Netlify refuses wrong bearer before authorized research can call GitHub',async()=>{
  let providerCalls=0;
  const fetchImpl=async()=>{providerCalls++;return {ok:true,status:200,json:async()=>({
    full_name:'Papa3445/Pro-Papa',id:1427703038,private:false,
    default_branch:'main',stargazers_count:2,open_issues_count:0,
    description:'Fixture-public',
    html_url:'https://github.com/Papa3445/Pro-Papa'
  })};};
  const app=handler({githubResearch:true,allowRepositories:['Papa3445/Pro-Papa'],fetchImpl});
  const msg=execute('research',{repository:'Papa3445/Pro-Papa'});
  for(const auth of ['','Bearer wrong','Basic '+KEY]){
    const denied=await app(request(msg,{headers:{Authorization:auth}}));
    assert.equal(denied.status,401);
    assert.equal(providerCalls,0);
    assert.equal(await denied.text(),'');
  }
  const permitted=await parsed(await app(request(msg)));
  assert.equal(permitted.status,200);
  assert.equal(permitted.body.result.isError,false);
  assert.equal(providerCalls,1);
  assert.equal(permitted.body.result.structuredContent.execution.output.repository,'Papa3445/Pro-Papa');
  assert.equal(verifyReleasedExecution(permitted.body.result.structuredContent),true);
});

test('PP-0007 Netlify fails closed with missing or weak startup configuration',async()=>{
  for(const opts of [{},{bearerToken:KEY},{hostname:HOST},{bearerToken:'short',hostname:HOST},
    {bearerToken:KEY,hostname:'evil/path'},{bearerToken:KEY,hostname:'A.COM'}]){
    assert.throws(()=>createReadOnlyMcpWebHandler(opts),/configuration/);
  }
  assert.throws(()=>createReadOnlyMcpWebHandler({
    bearerToken:KEY,hostname:HOST,allowedOrigins:['*']
  }),/configuration/);
  assert.throws(()=>createReadOnlyMcpWebHandler({
    bearerToken:KEY,hostname:HOST,allowRepositories:['Papa3445/Pro-Papa;evil']
  }),/configuration/);
});

test('PP-0007 Netlify rejects host, origin and transport downgrade',async()=>{
  const app=handler();
  const msg=call('tools/list',1,{});
  const evil=await app(request(msg,{url:'https://evil.example/mcp'}));
  assert.equal(evil.status,404);
  const spoof=await app(request(msg,{headers:{Host:'evil.example'}}));
  assert.equal(spoof.status,403);
  const crossOrigin=await app(request(msg,{headers:{Origin:'https://evil.example'}}));
  assert.equal(crossOrigin.status,403);
  const http=await app(request(msg,{url:'http://'+HOST+'/mcp'}));
  assert.equal(http.status,404);
  const get=await app(new Request(BASE,{method:'GET',headers:{Authorization:'Bearer '+KEY}}));
  assert.equal(get.status,405);
  assert.equal(get.headers.get('allow'),'POST');
  const query=await app(request(msg,{url:BASE+'?secret=abc'}));
  assert.equal(query.status,404);
});

test('PP-0007 Netlify validates JSON-RPC, inputs and request body bounds',async()=>{
  const app=handler();
  const errors=[
    [request('{invalid'),400,-32700],
    [request(call('unknown/method',2,{})),200,-32601],
    [request(call('initialize',3,{protocolVersion:'2024-01-01'})),200,-32602],
    [request(call('tools/call',4,{name:'pro_papa_execute_readonly',
      arguments:{objective:'test',capability:'operations',inputs:{}}})),200,-32602],
    [request(call('tools/call',4,{name:'pro_papa_execute_readonly',
      arguments:{objective:'test',capability:'math.sum',traceMode:'off',inputs:{}}})),200,-32602],
    [request(call('tools/list',1,{}),{headers:{'Mcp-Protocol-Version':'2099-01-01'}}),400,-32600],
    [request(call('tools/list',1,{}),{headers:{Accept:'application/json'}}),406,-32600],
    [request(JSON.stringify({jsonrpc:'2.0',method:'ping',id:1,padding:'x'.repeat(70000)})),413,-32600]
  ];
  for(const [req,status,code] of errors){
    const reply=await parsed(await app(req));
    assert.equal(reply.status,status);
    assert.equal(reply.body.error.code,code);
  }
});

test('PP-0007 Netlify denied tool is never exposed as structured success',async()=>{
  const app=handler();
  const denied=await parsed(await app(request(execute('research',{repository:'Papa3445/Pro-Papa'}))));
  assert.equal(denied.status,200);
  assert.equal(denied.body.result.isError,true);
  assert.equal(denied.body.result.structuredContent,undefined);
  const obj=JSON.parse(denied.body.result.content[0].text);
  assert.equal(obj.execution,null);
  assert.equal(obj.trace.state,'not_released');
});

test('PP-0007 Netlify entrypoint refuses to serve when runtime config absent',async()=>{
  const old=globalThis.Netlify;
  try {
    globalThis.Netlify={env:{get:()=>undefined}};
    const without=await netlifyMcp(request(call('tools/list',1,{})));
    assert.equal(without.status,503);
    assert.equal((await without.text()),'Service unavailable');
    const legacy={PRO_PAPA_MCP_TOKEN:KEY,PRO_PAPA_MCP_PUBLIC_HOSTNAME:HOST};
    globalThis.Netlify={env:{get:key=>legacy[key]}};
    const staticBearerOnly=await netlifyMcp(request(call('tools/list',1,{})));
    assert.equal(staticBearerOnly.status,503);
    const values={PRO_PAPA_MCP_PUBLIC_HOSTNAME:HOST,
      PRO_PAPA_AUTH0_ISSUER:'https://personal-fixture.us.auth0.com/',
      PRO_PAPA_MCP_RESOURCE:'https://'+HOST};
    globalThis.Netlify={env:{get:key=>values[key]}};
    const withOAuth=await parsed(await netlifyMcp(request(call('tools/list',1,{}))));
    assert.equal(withOAuth.status,200);
    assert.equal(withOAuth.body.result.tools[0].name,'pro_papa_execute_readonly');
    assert.deepEqual(withOAuth.body.result.tools[0].securitySchemes,
      [{type:'oauth2',scopes:['pro_papa.read']}]);
    const published=await netlifyMcp(new Request('https://'+HOST+
      '/.well-known/oauth-protected-resource',{method:'GET'}));
    assert.equal(published.status,200);
    assert.equal((await published.json()).resource,'https://'+HOST);
  }finally{globalThis.Netlify=old;}
});
