// Bounded live staging smoke. No credentials, cookies, GitHub secrets or user data.
// The only allowed origin is our dedicated Vercel Hobby staging domain.
// A pass proves anonymous HTTP routing and JWT denial, not a positive Auth0 grant.
import assert from 'node:assert/strict';

const ORIGIN='https://pro-papa-mcp-staging.vercel.app';
const ISSUER='https://dev-tzvdy337r0wqo8r5.us.auth0.com/';
const MAX_BYTES=16384;
const HEADERS={Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-06-18'};

async function hit(path,init={}){
  assert.ok(['/mcp','/.well-known/oauth-protected-resource'].includes(path));
  const res=await fetch(ORIGIN+path,{
    redirect:'error',signal:AbortSignal.timeout(12000),...init
  });
  console.log(JSON.stringify({path,method:init.method??'GET',status:res.status}));
  return res;
}
async function readJson(res,label){
  assert.match(res.headers.get('content-type')??'',/^application\/json\b/i,label+' content type');
  if(Number(res.headers.get('content-length')??0)>MAX_BYTES)throw Error(label+' too large');
  let n=0;
  const parts=[];
  if(!res.body)throw Error(label+' empty body');
  for await(const chunk of res.body){
    n+=chunk.byteLength;
    if(n>MAX_BYTES)throw Error(label+' too large');
    parts.push(chunk);
  }
  const bytes=new Uint8Array(n);
  let p=0;
  for(const c of parts){bytes.set(c,p);p+=c.byteLength}
  return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));
}
function rpc(method,id,params){
  return JSON.stringify({jsonrpc:'2.0',id,method,params});
}
async function post(id,method,params,extraHeaders={}){
  return hit('/mcp',{method:'POST',headers:{...HEADERS,...extraHeaders},body:rpc(method,id,params)});
}
function denied(msg,id){
  assert.equal(msg.jsonrpc,'2.0');
  assert.equal(msg.id,id);
  assert.equal(msg.result?.isError,true,'tool invocation must not be released');
  assert.equal(Object.hasOwn(msg.result??{},'structuredContent'),false,'no tool output on denial');
  assert.deepEqual(msg.result?.content,[{type:'text',text:'Authentication required'}]);
  const challenge=msg.result?._meta?.['mcp/www_authenticate'];
  assert.ok(Array.isArray(challenge)&&challenge.length===1);
  assert.ok(challenge[0].includes('resource_metadata="'+ORIGIN+'/.well-known/oauth-protected-resource"'));
  assert.ok(challenge[0].includes('scope="pro_papa.read"'));
}
async function main(){
  const outcomes=[];
  // Read only public Auth0 discovery and signing-key metadata. No credentials.
  const discovery=await fetch(ISSUER+'.well-known/openid-configuration',{
    redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}
  });
  console.log(JSON.stringify({endpoint:'auth0-oidc-discovery',status:discovery.status}));
  assert.equal(discovery.status,200,'Auth0 public OIDC discovery must return 200');
  const auth0=await readJson(discovery,'auth0 discovery');
  assert.equal(auth0.issuer,ISSUER,'Auth0 issuer must match configured canonical issuer');
  assert.equal(auth0.jwks_uri,ISSUER+'.well-known/jwks.json','issuer must serve expected signing keys');
  assert.ok(auth0.authorization_endpoint?.startsWith(ISSUER));
  assert.ok(auth0.token_endpoint?.startsWith(ISSUER));
  outcomes.push('auth0-discovery-issuer-200');
  const jwksResponse=await fetch(auth0.jwks_uri,{
    redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}
  });
  console.log(JSON.stringify({endpoint:'auth0-public-jwks',status:jwksResponse.status}));
  assert.equal(jwksResponse.status,200,'Auth0 JWKS must be reachable');
  const jwks=await readJson(jwksResponse,'auth0 JWKS');
  assert.ok(Array.isArray(jwks.keys)&&jwks.keys.length>=1&&jwks.keys.length<=20);
  assert.ok(jwks.keys.some(k=>k.kty==='RSA'&&k.kid&&k.n&&k.e));
  outcomes.push('auth0-jwks-reachable');

  const metadata=await hit('/.well-known/oauth-protected-resource',{headers:{Accept:'application/json'}});
  assert.equal(metadata.status,200,'static OAuth metadata must be HTTP 200');
  const doc=await readJson(metadata,'metadata');
  assert.deepEqual(doc,{
    resource:ORIGIN,
    authorization_servers:[ISSUER],
    scopes_supported:['pro_papa.read']
  },'metadata must match the exact pre-registered staging API');
  outcomes.push('metadata-200-exact');

  const get=await hit('/mcp');
  assert.equal(get.status,405,'MCP GET must not dispatch a tool');
  outcomes.push('mcp-get-405');

  const init=await post(601,'initialize',{
    protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'staging-negative-smoke',version:'1'}
  });
  assert.equal(init.status,200);
  const ini=await readJson(init,'initialize');
  assert.equal(ini.jsonrpc,'2.0');
  assert.equal(ini.id,601);
  assert.equal(ini.result?.serverInfo?.name,'pro-papa-readonly');
  outcomes.push('initialize-200');

  const tools=await post(602,'tools/list',{});
  assert.equal(tools.status,200);
  const list=await readJson(tools,'tools/list');
  assert.deepEqual(list.result?.tools?.map(t=>t.name),['pro_papa_execute_readonly']);
  outcomes.push('tools-list-200');

  const params={name:'pro_papa_execute_readonly',arguments:{
    objective:'No credential smoke; must never execute',capability:'math.sum',inputs:{numbers:[3,5]}
  }};
  const anon=await post(603,'tools/call',params);
  assert.equal(anon.status,200);
  denied(await readJson(anon,'anonymous tools/call'),603);
  outcomes.push('anonymous-tool-denied');

  const malformed=await post(604,'tools/call',params,{Authorization:'Bearer deliberately-invalid-sample'});
  assert.equal(malformed.status,200);
  denied(await readJson(malformed,'invalid token tools/call'),604);
  outcomes.push('invalid-token-denied');

  const untrusted=await post(605,'tools/call',params,{Origin:'https://untrusted.example'});
  assert.equal(untrusted.status,403,'untrusted origin must fail');
  outcomes.push('untrusted-origin-403');

  console.log(JSON.stringify({status:'passed',origin:ORIGIN,checks:outcomes,realAuthorizedJwtTested:false,netlifyTouched:false}));
}
main().catch(err=>{
  // No URL echoes, HTTP response bodies, credentials or secret material.
  console.error('Vercel staging HTTP smoke FAILED:',String(err?.message??'unknown'));
  process.exitCode=1;
});
