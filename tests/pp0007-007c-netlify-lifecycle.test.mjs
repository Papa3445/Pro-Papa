import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import netlifyMcp from '../netlify/functions/mcp.mjs';

// Security regression for reviewed existing behavior, not a production load test.
// Historical audited wrapper created a handler per call. A later exact-blobbbed
// remediation candidate reuses a warm instance, and must not be misgraded
// as the historical vulnerability.
const HOST='pp0007-lifecycle-fixture.netlify.app';
const RESOURCE='https://'+HOST;
const ISSUER='https://pp0007-lifecycle.us.auth0.com/';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'lifecycle-fixture-key',
  alg:'RS256',use:'sig'};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function bearer(){
  const now=Math.floor(Date.now()/1000);
  const head=b64({alg:'RS256',typ:'JWT',kid:jwk.kid});
  const payload=b64({iss:ISSUER,aud:RESOURCE,exp:now+3600,iat:now-60,
    nbf:now-60,sub:'fixture|subject',scope:'pro_papa.read'});
  const text=head+'.'+payload;
  return text+'.'+sign('RSA-SHA256',Buffer.from(text),privateKey).toString('base64url');
}
function req(token,requestId){
 return new Request(RESOURCE+'/mcp',{method:'POST',headers:{
   'Content-Type':'application/json',
   Accept:'application/json, text/event-stream',
   Authorization:'Bearer '+token
 },body:JSON.stringify({jsonrpc:'2.0',id:requestId,method:'tools/call',params:{
   name:'pro_papa_execute_readonly',arguments:{
     objective:'Local lifecycle regression: sum test numbers',
     capability:'math.sum',inputs:{numbers:[2,3,5]}
   }
 }})});
}
test('007-C: pinned historical Netlify cache loss versus exact remediation candidate',async()=>{
 const original=readFileSync(new URL('../netlify/functions/mcp.mjs',import.meta.url));
 const sha=createHash('sha1').update('blob '+original.length+'\x00').update(original).digest('hex');
 const isHistorical=sha==='d462bd6e82fb4f4857c8d0cc61feb43ab46980fc';
 const successor=sha!=='3c225ee178f3c949aff60c0e75b9ef40bf69a7d4'&&!isHistorical;
 if(successor){
   const wrapper=original.toString('utf8');
   assert.match(wrapper,/warmHandler/);
   assert.match(wrapper,/createOAuthResourceValidator/);
   assert.match(wrapper,/artifactValidationEnabled/);
   assert.match(wrapper,/createReadOnlyMcpWebHandler/);
 }
 // The immutable old/candidate blobs remain pinned in historical evidence;
 // successor wrappers are challenged by actual warm-cache behavior below.
 const originalNetlify=globalThis.Netlify,originalFetch=globalThis.fetch;
 const values={PRO_PAPA_MCP_PUBLIC_HOSTNAME:HOST,PRO_PAPA_AUTH0_ISSUER:ISSUER,
   PRO_PAPA_MCP_RESOURCE:RESOURCE};
 let jwksLookups=0;
 try{
   globalThis.Netlify={env:{get:key=>values[key]}};
   globalThis.fetch=async(url,opts)=>{
     assert.equal(url,ISSUER+'.well-known/jwks.json');
     assert.equal(opts.redirect,'error');
     jwksLookups++;
     return new Response(JSON.stringify({keys:[jwk]}),{
       headers:{'Content-Type':'application/json'}});
   };
   const signed=bearer();
   const exercise=async(id)=>{
     const response=await netlifyMcp(req(signed,id));
     assert.equal(response.status,200);
     const result=(await response.json()).result;
     assert.equal(result.isError,false);
     assert.equal(result.structuredContent.status,'completed');
     assert.equal(result.structuredContent.trace.state,'released');
     assert.deepEqual(result.structuredContent.execution.output,{total:10,count:3});
   };
   await exercise(1);
   assert.equal(jwksLookups,1);
   await exercise(2);
   assert.equal(jwksLookups,isHistorical?2:1,
     'the historical wrapper recreates a cache per request; remediated warm instance reuses it');
   // Below local eight-active limit; the separate #38 test challenges the ninth request.
   await Promise.all(Array.from({length:7},(_,i)=>exercise(100+i)));
   assert.equal(jwksLookups,isHistorical?9:1,
     'historical request isolation vs pinned warm-instance cache reuse');
 }finally{
   globalThis.fetch=originalFetch;
   if(originalNetlify===undefined)delete globalThis.Netlify;
   else globalThis.Netlify=originalNetlify;
 }
});
// This test measures local JWKS cache reconstruction. It deliberately does NOT
// claim proof that nine host executions were simultaneously in flight or that
// production global request-concurrency/edge limits were exercised.
