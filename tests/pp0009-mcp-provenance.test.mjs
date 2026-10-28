import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createMcpCallProvenance} from '../src/mcp-call-provenance.mjs';
import {createReadOnlyMcpWebHandler} from '../src/mcp-web.mjs';
import {createReadOnlyMcpServer} from '../src/mcp-bridge.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const KEY='pp0009-fixture-not-a-secret-long-enough-123456789';
const HOST='pp0009-example.netlify.app';
const envelope=(id=7,objective='safe arithmetic')=>({
  jsonrpc:'2.0',id,method:'tools/call',
  params:{name:'pro_papa_execute_readonly',arguments:{
    objective,capability:'math.sum',inputs:{numbers:[2,3]}}}
});
const args=(message,status='completed',sha='a'.repeat(64))=>({
  message,capability:'math.sum',status,executionSha256:sha
});
const requireCall=(result)=>{
  const content=JSON.parse(result.content[0].text);
  assert.deepEqual(content,result.structuredContent);
  assert.deepEqual(result._meta['pro-papa/call-provenance'],content.callProvenance);
  const record=content.callProvenance;
  assert.equal(record.schemaVersion,1);
  assert.match(record.id,/^[a-f0-9-]{36}$/);
  assert.equal(record.method,'tools/call');
  assert.equal(record.capability,'math.sum');
  assert.equal(record.status,'completed');
  assert.equal(record.executionSha256,content.trace.executionSha256);
  assert.equal(record.scope,'single_explicit_mcp_tool_call');
  assert.equal(record.retention,'response_only');
  assert.equal(record.providerAuthenticated,false);
  assert.match(record.requestHmacSha256,/^[a-f0-9]{64}$/);
  assert.equal(verifyReleasedExecution(content),true);
  return record;
};

test('PP-0009 private host-key request MAC binds one real call and fails on tampering',()=>{
  const signer=createMcpCallProvenance(),message=envelope();
  const good=signer.issue(args(message));
  assert.equal(signer.verify(good,args(message)),true);
  assert.equal(signer.verify(good,args({...message,id:8})),false);
  assert.equal(signer.verify(good,args(envelope(7,'different private objective'))),false);
  assert.equal(signer.verify(good,args(message,'denied',null)),false);
  assert.equal(signer.verify({...good,id:'00000000-0000-4000-8000-000000000000'},args(message)),false);
  assert.equal(signer.verify({...good,requestHmacSha256:'0'.repeat(64)},args(message)),false);
  assert.equal(signer.verify({...good,capability:'text.metrics'},args(message)),false);
  assert.equal(signer.verify({...good,executionSha256:null},args(message)),false);
  assert.equal(signer.verify({...good,unexpected:'value'},args(message)),false);
  assert.equal(createMcpCallProvenance().verify(good,args(message)),false);
  const second=signer.issue(args(message));
  assert.notEqual(second.id,good.id);
  assert.notEqual(second.requestHmacSha256,good.requestHmacSha256);
  const wire=JSON.stringify(good);
  assert.ok(!wire.includes(message.params.arguments.objective));
  assert.ok(!wire.includes('pp0009-fixture'));
  assert.ok(!Object.keys(good).some(x=>/token|objective|raw|arguments/i.test(x)));
});

test('PP-0009 web MCP emits independent response-only correlation, not on handshake or denied authentication',async()=>{
  const app=createReadOnlyMcpWebHandler({hostname:HOST,bearerToken:KEY});
  const headers={Authorization:'Bearer '+KEY,'Content-Type':'application/json',
    Accept:'application/json, text/event-stream'};
  const request=(msg,h=headers)=>new Request('https://'+HOST+'/mcp',{
    method:'POST',headers:h,body:JSON.stringify(msg)});
  const ping=await (await app(request({jsonrpc:'2.0',method:'ping',id:1}))).json();
  assert.equal(ping.result._meta,undefined);
  const msg=envelope(9);
  const response=await app(request(msg));
  assert.equal(response.status,200);
  const result=(await response.json()).result;
  const first=requireCall(result);
  assert.equal(result.structuredContent.execution.output.total,5);
  const again=(await (await app(request(msg))).json()).result;
  const second=requireCall(again);
  assert.notEqual(first.id,second.id);
  assert.notEqual(first.requestHmacSha256,second.requestHmacSha256);
  const unauthorized=await app(request(msg,{...headers,Authorization:'Bearer invalid'}));
  assert.equal(unauthorized.status,401);
  assert.equal(await unauthorized.text(),'');
  const invalid=envelope(10,'private but malformed');
  invalid.params.arguments.capability='unknown.action';
  const bad=await (await app(request(invalid))).json();
  assert.equal(bad.error.code,-32602);
  assert.equal(bad.result,undefined);
  assert.equal(JSON.stringify(bad).includes('callProvenance'),false);
});

test('PP-0009 loopback MCP binds explicit local tool result to same provenance schema',async t=>{
  const app=createReadOnlyMcpServer({bearerToken:KEY});
  const address=await app.listen(0);
  t.after(()=>app.close());
  const call=payload=>new Promise((resolve,reject)=>{
    const req=httpRequest({host:'127.0.0.1',port:address.port,path:'/mcp',
      method:'POST',headers:{Authorization:'Bearer '+KEY,
      Accept:'application/json, text/event-stream','Content-Type':'application/json'}},res=>{
      const chunks=[];res.on('data',x=>chunks.push(x));
      res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error',reject);req.end(JSON.stringify(payload));
  });
  const result=await call(envelope(11));
  assert.equal(result.status,200);
  const record=requireCall(result.body.result);
  assert.equal(record.status,'completed');
  const handshake=await call({jsonrpc:'2.0',id:1,method:'ping'});
  assert.equal(handshake.body.result._meta,undefined);
});
