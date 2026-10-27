// PP-0007 — manual-only authenticated Auth0 M2M production smoke.
// No token, secret, issuer hostname, JWT claims or response body may be logged.
import {pathToFileURL} from 'node:url';
import {PRODUCTION_ORIGIN,boundedJson} from './pp0007-production-smoke.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const fail=(message)=>{throw Error(message)};
const issuerOk=s=>typeof s==='string'&&s.length<=512&&
  /^https:\/\/[a-z0-9][a-z0-9.-]*\.auth0\.com\/$/.test(s)&&
  (()=>{try{return new URL(s).origin+'/'===s}catch{return false}})();
const secretOk=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n&&
  !/[\u0000-\u001f\u007f]/.test(s);
const request=async(fetchImpl,url,options,label)=>{
  try{return await fetchImpl(url,{redirect:'error',
    signal:AbortSignal.timeout(8000),...options})}
  catch{fail(label+'_network_failed')}
};
const parse=async(response,label)=>{
  if(response.status!==200)fail(label+'_bad_status');
  try{return await boundedJson(response)}catch{fail(label+'_invalid_json')}
};
const isJwt=s=>typeof s==='string'&&s.length<=16384&&
  s.split('.').length===3&&s.split('.').every(x=>x.length>0&&/^[A-Za-z0-9_-]+$/.test(x));
function tamper(jwt){
  const parts=jwt.split('.');
  parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  return parts.join('.');
}
const rpcBody=id=>JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',
  params:{name:'pro_papa_execute_readonly',arguments:{
    objective:'Authorized production smoke, read-only math 3+4',
    capability:'math.sum',inputs:{numbers:[3,4]}
  }}});
async function call(fetchImpl,token,id){
  return parse(await request(fetchImpl,PRODUCTION_ORIGIN+'/mcp',{
    method:'POST',headers:{
      Authorization:'Bearer '+token,'Content-Type':'application/json',
      Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'
    },body:rpcBody(id)
  },'mcp'),'mcp');
}
const passed=rpc=>rpc?.jsonrpc==='2.0'&&rpc.id===801&&
  rpc.result?.isError===false&&
  rpc.result.structuredContent?.status==='completed'&&
  rpc.result.structuredContent?.execution?.output?.total===7&&
  rpc.result.structuredContent?.execution?.output?.count===2&&
  rpc.result.structuredContent?.trace?.state==='released'&&
  rpc.result.structuredContent?.trace?.dispatchedCapability==='math.sum'&&
  rpc.result.structuredContent?.execution?.provenance?.provider==='local-node'&&
  rpc.result.structuredContent?.execution?.provenance?.operation==='math.sum'&&
  verifyReleasedExecution(rpc.result.structuredContent)&&
  // A server must not supply contradictory user-visible and structured outputs.
  Array.isArray(rpc.result.content)&&rpc.result.content.length===1&&
  rpc.result.content[0]?.type==='text'&&
  rpc.result.content[0].text===JSON.stringify(rpc.result.structuredContent);
const denied=rpc=>rpc?.jsonrpc==='2.0'&&rpc.id===802&&
  rpc.result?.isError===true&&
  !Object.hasOwn(rpc.result,'structuredContent')&&
  rpc.result.content?.some(x=>x?.type==='text'&&x.text==='Authentication required')&&
  rpc.result._meta?.['mcp/www_authenticate']?.some(x=>
    typeof x==='string'&&x.includes('error="invalid_token"')&&
    x.includes('resource_metadata="'+PRODUCTION_ORIGIN+'/.well-known/oauth-protected-resource"'));

/** Four bounded HTTPS requests; verify the issuer out-of-band BEFORE transmitting secrets. */
export async function runSignedJwtSmoke({fetchImpl=globalThis.fetch,
  clientId,clientSecret,expectedIssuer}={}){
  if(typeof fetchImpl!=='function'||!issuerOk(expectedIssuer)||
    !secretOk(clientId,256)||!secretOk(clientSecret,512))
    fail('private_preflight_unavailable');
  const metaRes=await request(fetchImpl,
    PRODUCTION_ORIGIN+'/.well-known/oauth-protected-resource',
    {method:'GET',headers:{Accept:'application/json'}},'metadata');
  const meta=await parse(metaRes,'metadata');
  if(meta.resource!==PRODUCTION_ORIGIN||metaRes.headers.get('cache-control')!=='no-store'||
    !Array.isArray(meta.authorization_servers)||
    meta.authorization_servers.length!==1||
    meta.authorization_servers[0]!==expectedIssuer||
    !Array.isArray(meta.scopes_supported)||
    !meta.scopes_supported.includes('pro_papa.read'))
    fail('metadata_issuer_pin_mismatch');

  // Only now send M2M credentials to EXACT pinned trusted Auth0 tenant.
  const data=new URLSearchParams({grant_type:'client_credentials',
    client_id:clientId,client_secret:clientSecret,
    audience:PRODUCTION_ORIGIN,scope:'pro_papa.read'});
  const auth=await parse(await request(fetchImpl,expectedIssuer+'oauth/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',
      Accept:'application/json'},body:data.toString()
  },'auth0'),'auth0');
  if(auth.token_type!=='Bearer'||!isJwt(auth.access_token)||
    !Number.isSafeInteger(auth.expires_in)||auth.expires_in<30)
    fail('invalid_auth0_access_token');
  const ok=await call(fetchImpl,auth.access_token,801);
  if(!passed(ok))fail('valid_jwt_not_authorized');
  const no=await call(fetchImpl,tamper(auth.access_token),802);
  if(!denied(no))fail('tampered_jwt_not_rejected');
  return {status:'passed',origin:PRODUCTION_ORIGIN,
    checks:['pinned_auth0_token_issued','authorized_math_sum_released',
      'tampered_signature_denied'],
    limits:'Not tested: authentic wrong-scope/audience/expired JWT, JWKS rotation, user OAuth, distributed caps or end-to-end ChatGPT interception.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3||process.argv[2]!=='--live'){
    console.error('Usage: node bin/pp0007-signed-jwt-smoke.mjs --live');
    process.exitCode=2;
  }else{
    try{console.log(JSON.stringify(await runSignedJwtSmoke({
      clientId:process.env.PRO_PAPA_SMOKE_CLIENT_ID,
      clientSecret:process.env.PRO_PAPA_SMOKE_CLIENT_SECRET,
      expectedIssuer:process.env.PRO_PAPA_SMOKE_EXPECTED_ISSUER
    })))}
    catch{
      // Generic error: never print fetch error, JWT, tenant URL or server response.
      console.error('Authenticated smoke FAILED; inspect private grant and configuration');
      process.exitCode=1;
    }
  }
}
