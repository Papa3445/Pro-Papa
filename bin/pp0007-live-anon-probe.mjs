// PP-0007: public, credential-free live negative-auth smoke test.
// Fixed production origin; never send a real bearer, session cookie or user content.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const RESOURCE='https://pro-papa-mcp.netlify.app';
const SCOPE='pro_papa.read';
const ACCEPT='application/json, text/event-stream';
const toolCall=id=>({jsonrpc:'2.0',id,method:'tools/call',params:{
  name:'pro_papa_execute_readonly',arguments:{objective:'Credential-free negative authorization probe',
    capability:'math.sum',inputs:{numbers:[19,23]}}}});

function assertNoRelease(reply,label){
  assert.equal(reply?.jsonrpc,'2.0',label+': JSON-RPC required');
  assert.equal(reply?.result?.isError,true,label+': denial required');
  assert.equal(Object.hasOwn(reply.result,'structuredContent'),false,label+': no structured result');
  assert.ok(Array.isArray(reply.result.content),label+': visible denial required');
  assert.ok(reply.result.content.some(x=>x?.type==='text'&&x.text==='Authentication required'),
    label+': expected authentication denial');
}
async function boundedJson(res,label){
  assert.equal(res.status,200,label+': expected HTTP 200');
  const type=res.headers.get('content-type')??'';
  assert.match(type,/^application\/json(?:\s*;|$)/i,label+': expected JSON');
  const body=await res.text();
  assert.ok(body.length>0&&body.length<=16384,label+': response size limit');
  return JSON.parse(body);
}
/** Tests are deliberately anonymous. fetchImpl injection is for offline unit tests only. */
export async function probeAnonymousMcp({fetchImpl=globalThis.fetch}={}){
  assert.equal(typeof fetchImpl,'function');
  const get=async(path,opts={})=>fetchImpl(RESOURCE+path,{method:'GET',redirect:'error',
    signal:AbortSignal.timeout(10000),...opts});
  const post=async(payload,headers={})=>fetchImpl(RESOURCE+'/mcp',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'application/json',Accept:ACCEPT,...headers},
    body:JSON.stringify(payload)});
  const meta=await boundedJson(await get('/.well-known/oauth-protected-resource'),'metadata');
  assert.equal(meta.resource,RESOURCE);
  assert.deepEqual(meta.scopes_supported,[SCOPE]);
  assert.ok(Array.isArray(meta.authorization_servers)&&meta.authorization_servers.length===1);
  assert.match(meta.authorization_servers[0],/^https:\/\/[a-z0-9-]+\.us\.auth0\.com\/$/);

  const getMcp=await get('/mcp');
  assert.equal(getMcp.status,405,'GET /mcp must not process tool execution');

  const anon=await boundedJson(await post(toolCall(901)),'anonymous tools/call');
  assertNoRelease(anon,'anonymous tools/call');

  const invalid=await boundedJson(await post(toolCall(902),{
    Authorization:'Bearer not-a-jwt'}),'invalid bearer tools/call');
  assertNoRelease(invalid,'invalid bearer tools/call');

  const wrongOrigin=await post(toolCall(903),{Origin:'https://untrusted.example'});
  assert.equal(wrongOrigin.status,403,'Cross-origin request must be denied');

  return {status:'passed',scope:'public-anonymous-negative-only',
    resource:RESOURCE,checks:['metadata-200','get-mcp-405',
      'no-bearer-tools-call-denied','invalid-bearer-tools-call-denied','cross-origin-403'],
    liveAuthenticatedJwtVerified:false,hostInvocationCountObserved:null,
    note:'HTTP responses prove the tested requests had no released result; they do not prove every request was blocked or that all internal hosts remained idle.'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await probeAnonymousMcp();
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(e){
    process.stderr.write('PP-0007 public anonymous probe failed: '+e.message+'\n');
    process.exitCode=1;
  }
}
