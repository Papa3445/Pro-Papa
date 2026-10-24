import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createReadOnlyMcpServer} from '../src/mcp-bridge.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const ACCEPT='application/json, text/event-stream';
const call=(method,id,params)=>({jsonrpc:'2.0',method,id,params});
async function setup(t,opts={}){
  const app=createReadOnlyMcpServer(opts);
  const bound=await app.listen(0);
  t.after(()=>app.close());
  return {port:bound.port,url:'http://127.0.0.1:'+bound.port+'/mcp'};
}
function post(url,body,{headers={},method='POST',path='/mcp'}={}){
  const dest=new URL(url);
  return new Promise((resolve,reject)=>{
    const req=httpRequest({hostname:'127.0.0.1',port:dest.port,path,method,headers:{
      'Accept':ACCEPT,'Content-Type':'application/json',...headers}},res=>{
      const list=[];res.on('data',chunk=>list.push(chunk));res.on('end',()=>{
        const text=Buffer.concat(list).toString('utf8');
        let json=null;try{json=JSON.parse(text);}catch{}
        resolve({status:res.statusCode,headers:res.headers,text,json});
      });
    });
    req.on('error',reject);
    if(body!==undefined)req.write(typeof body==='string'?body:JSON.stringify(body));
    req.end();
  });
}
const execute=(objective,capability,inputs)=>call('tools/call',4,{
  name:'pro_papa_execute_readonly',arguments:{objective,capability,inputs}
});

test('PP-0007 MCP protocol handshake, read-only discovery and no SSE requirement',async t=>{
  const {url}=await setup(t);
  const hello=await post(url,call('initialize',1,{protocolVersion:'2025-11-25',
    clientInfo:{name:'test',version:'1'},capabilities:{}}));
  assert.equal(hello.status,200);
  assert.equal(hello.json.result.protocolVersion,'2025-11-25');
  assert.equal(hello.json.result.capabilities.tools.listChanged,false);
  assert.equal(hello.json.id,1);
  const old=await post(url,call('initialize',2,{protocolVersion:'2025-06-18'}));
  assert.equal(old.json.result.protocolVersion,'2025-06-18');
  const list=await post(url,call('tools/list',3,{}));
  assert.equal(list.status,200);
  assert.equal(list.json.result.tools.length,1);
  const tool=list.json.result.tools[0];
  assert.equal(tool.name,'pro_papa_execute_readonly');
  assert.equal(tool.annotations.readOnlyHint,true);
  assert.equal(tool.inputSchema.properties.capability.enum.includes('operations'),false);
  assert.equal(tool.inputSchema.properties.capability.enum.includes('research'),true);
  const notify=await post(url,{jsonrpc:'2.0',method:'notifications/initialized'});
  assert.equal(notify.status,202);
  assert.equal(notify.text,'');
  const get=await post(url,undefined,{method:'GET'});
  assert.equal(get.status,405);
});

test('PP-0007 MCP tool executes math through real verified host and returns causal trace',async t=>{
  const {url}=await setup(t);
  const res=await post(url,execute('Sum exactly three numbers','math.sum',{numbers:[2,3,5]}));
  assert.equal(res.status,200);
  assert.equal(res.json.id,4);
  const result=res.json.result;
  assert.equal(result.isError,false);
  assert.equal(result.structuredContent.status,'completed');
  assert.equal(result.structuredContent.execution.output.total,10);
  assert.equal(verifyReleasedExecution(result.structuredContent),true);
  assert.deepEqual(result.structuredContent.trace.events.map(e=>e.step),[
    'request.accepted','audit.not_required','route.selected','handler.started',
    'handler.returned','output.validated','response.released']);
  assert.equal(result.structuredContent.trace.providerAuthenticated,false);
  assert.equal(result.structuredContent.trace.scope,'single_explicit_reference_host_invocation');
  assert.equal(JSON.parse(result.content[0].text).execution.output.total,10);
  assert.equal(JSON.stringify(result).includes('GITHUB_TOKEN'),false);
  const text=await post(url,execute('The sun is bright','text.metrics',{}));
  assert.equal(text.json.result.isError,false);
  assert.equal(text.json.result.structuredContent.execution.output.words,4);
});

test('PP-0007 MCP rejects unsupported, ungranted, and malformed calls without releasing output',async t=>{
  const {url}=await setup(t);
  const noGrant=await post(url,execute('Research a repo','research',{repository:'Papa3445/Pro-Papa'}));
  assert.equal(noGrant.status,200);
  assert.equal(noGrant.json.result.isError,true);
  const denied=JSON.parse(noGrant.json.result.content[0].text);
  assert.equal(denied.status,'denied');
  assert.equal(denied.execution,null);
  assert.equal(denied.trace.state,'not_released');
  assert.equal(noGrant.json.result.structuredContent,undefined);
  for(const params of [
    {name:'create_issue',arguments:{objective:'publish',capability:'operations'}},
    {name:'pro_papa_execute_readonly',arguments:{objective:'hi',capability:'operations'}},
    {name:'pro_papa_execute_readonly',arguments:{objective:'hi',capability:'math.sum',auditMode:'off'}},
    {name:'pro_papa_execute_readonly',arguments:{objective:'hi',capability:'math.sum',inputs:[]}},
    {name:'pro_papa_execute_readonly',arguments:{objective:'',capability:'math.sum'}},
  ]){
    const invalid=await post(url,call('tools/call',11,params));
    assert.equal(invalid.json.error.code,-32602);
    assert.equal(invalid.json.result,undefined);
  }
  const providerError=await post(url,execute('sum bad inputs','math.sum',{numbers:['2','3']}));
  assert.equal(providerError.json.result.isError,true);
  assert.equal(JSON.parse(providerError.json.result.content[0].text).execution,null);
});

test('PP-0007 MCP fail closed for forbidden origin, host spoof, authorization and paths',async t=>{
  const token='t'.repeat(45);
  const {url}=await setup(t,{bearerToken:token});
  const good=await post(url,call('tools/list',1,{}),{headers:{Authorization:'Bearer '+token}});
  assert.equal(good.status,200);
  for(const bearer of ['', 'Bearer wrong','Basic '+token]){
    const unauth=await post(url,call('tools/list',1,{}),{headers:bearer?{Authorization:bearer}:{}});
    assert.equal(unauth.status,401);
    assert.equal(unauth.text,'');
  }
  const evilOrigin=await post(url,call('tools/list',1,{}),{
    headers:{Origin:'https://evil.example',Authorization:'Bearer '+token}});
  assert.equal(evilOrigin.status,403);
  const evilHost=await post(url,call('tools/list',1,{}),{
    headers:{Host:'evil.example',Authorization:'Bearer '+token}});
  assert.equal(evilHost.status,403);
  const missing=await post(url,call('tools/list',1,{}),{
    path:'/admin',headers:{Authorization:'Bearer '+token}});
  assert.equal(missing.status,404);
});

test('PP-0007 MCP enforces HTTP JSON-RPC request bounds and protocol version',async t=>{
  const {url}=await setup(t);
  const bad=await post(url,'{bad-json');
  assert.equal(bad.status,400);
  assert.equal(bad.json.error.code,-32700);
  const other=await post(url,call('tools/list',9,{}),{
    headers:{'Mcp-Protocol-Version':'2099-01-01'}});
  assert.equal(other.status,400);
  const unsupported=await post(url,call('initialize',9,{protocolVersion:'2024-11-05'}));
  assert.equal(unsupported.json.error.code,-32602);
  const unknown=await post(url,call('whatever',10,{}));
  assert.equal(unknown.json.error.code,-32601);
  const oversize=await post(url,'{"jsonrpc":"2.0","method":"ping","id":1,"padding":"'+ 'a'.repeat(70000)+'"}');
  assert.equal(oversize.status,413);
  const noAccept=await post(url,call('tools/list',1,{}),{headers:{Accept:'application/json'}});
  assert.equal(noAccept.status,406);
});

test('PP-0007 MCP refuses public listen and insecure host configuration',async()=>{
  assert.throws(()=>createReadOnlyMcpServer({host:'0.0.0.0'}),/loopback/);
  assert.throws(()=>createReadOnlyMcpServer({host:'example.com'}),/loopback/);
  assert.throws(()=>createReadOnlyMcpServer({bearerToken:'short'}),/configuration/);
  assert.throws(()=>createReadOnlyMcpServer({allowedOrigins:['*']}),/configuration/);
  assert.throws(()=>createReadOnlyMcpServer({allowedHosts:['evil.com/path']}),/configuration/);
  assert.throws(()=>createReadOnlyMcpServer({auditMode:'required'}),/Unverified host/);
});
