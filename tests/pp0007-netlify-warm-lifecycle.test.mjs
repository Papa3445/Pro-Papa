import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import netlifyMcp from '../netlify/functions/mcp.mjs';

// Synthetic RS256 tokens/JWKS; zero live Auth0 or Netlify requests.
const ONE='pp0007-warm-fixture.netlify.app';
const TWO='pp0007-rotated-fixture.netlify.app';
const ISSUER_A='https://pp0007-warm-fixture.us.auth0.com/';
const ISSUER_B='https://pp0007-rotated-fixture.us.auth0.com/';
const {publicKey:keyA,privateKey:secretA}=generateKeyPairSync('rsa',{modulusLength:2048});
const {publicKey:keyB,privateKey:secretB}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=(key,kid)=>({...key.export({format:'jwk'}),kid,alg:'RS256',use:'sig'});
const A=jwk(keyA,'warm-a'),B=jwk(keyB,'warm-b');
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const fixture=(hostname,issuer)=>({
 PRO_PAPA_MCP_PUBLIC_HOSTNAME:hostname,
 PRO_PAPA_AUTH0_ISSUER:issuer,
 PRO_PAPA_MCP_RESOURCE:'https://'+hostname
});
function token({hostname=ONE,issuer=ISSUER_A,privateKey=secretA,kid=A.kid,now}){
 const head=encode({alg:'RS256',typ:'JWT',kid});
 const claims=encode({iss:issuer,aud:'https://'+hostname,scope:'pro_papa.read',
   sub:'fixture|warm',iat:now-60,nbf:now-60,exp:now+3600});
 const message=head+'.'+claims;
 return message+'.'+sign('RSA-SHA256',Buffer.from(message),privateKey).toString('base64url');
}
function call(hostname,id,bearer,capability='math.sum'){
 return new Request('https://'+hostname+'/mcp',{method:'POST',headers:{
  Accept:'application/json, text/event-stream',
  'Content-Type':'application/json',
  ...(bearer?{Authorization:'Bearer '+bearer}:{})
 },body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{
  name:'pro_papa_execute_readonly',
  arguments:{objective:'Bounded local request lifecycle test',capability,
   inputs:capability==='math.sum'?{numbers:[2,3,5]}:{repository:'Papa3445/Pro-Papa'}}
 }})});
}
async function output(response){
 assert.equal(response.status,200);
 return (await response.json()).result;
}
const jwksReply=keys=>new Response(JSON.stringify({keys}),{
 status:200,headers:{'Content-Type':'application/json'}
});
const githubReply=()=>new Response(JSON.stringify({
 full_name:'Papa3445/Pro-Papa',id:123,private:false,
 description:'fixture only',stargazers_count:0,open_issues_count:0,
 html_url:'https://github.com/Papa3445/Pro-Papa'
}),{status:200,headers:{'Content-Type':'application/json'}});
async function withEnv(initial,body){
 const oldNetlify=globalThis.Netlify,oldFetch=globalThis.fetch,oldNow=Date.now;
 const values={...initial};
 globalThis.Netlify={env:{get:key=>Object.hasOwn(values,key)?values[key]:null}};
 try{return await body({values,setFetch:fn=>{globalThis.fetch=fn},
  setNow:fn=>{Date.now=fn}});}
 finally{
  globalThis.fetch=oldFetch;
  Date.now=oldNow;
  if(oldNetlify===undefined)delete globalThis.Netlify;
  else globalThis.Netlify=oldNetlify;
 }
}
test('PP-0007 Netlify warm validator reuses JWKS and fails closed for rotation, refresh and config changes',async()=>{
 await withEnv(fixture(ONE,ISSUER_A),async({values,setFetch,setNow})=>{
  let clock=2000000000,lookups=0,keys=[A],throwJwks=false;
  setNow(()=>clock*1000);
  setFetch(async(url,options)=>{
   assert.equal(options.redirect,'error');
   assert.equal(url,values.PRO_PAPA_AUTH0_ISSUER+'.well-known/jwks.json');
   lookups++;
   if(throwJwks)throw Error('simulated JWKS outage');
   return jwksReply(keys);
  });
  const bearerA=token({now:clock});
  const permit=async(id,bearer,host=ONE)=>{
   const res=await output(await netlifyMcp(call(host,id,bearer)));
   assert.equal(res.isError,false);
   assert.equal(res.structuredContent.execution.output.total,10);
   assert.equal(res.structuredContent.trace.state,'released');
  };
  const deny=async(id,bearer,host=ONE)=>{
   const res=await output(await netlifyMcp(call(host,id,bearer)));
   assert.equal(res.isError,true);
   assert.equal(res.structuredContent,undefined);
   assert.equal(res.content[0].text,'Authentication required');
  };
  await permit(1,bearerA);
  await permit(2,bearerA);
  assert.equal(lookups,1,'sequential calls reuse warm validator');
  // Stay below the intentional eight-active warm-instance cap here; the\n  // separate held-provider test challenges the ninth request denial.\n  await Promise.all(Array.from({length:7},(_,i)=>permit(20+i,bearerA)));
  assert.equal(lookups,1,'concurrent calls share warm JWKS');
  clock+=299;
  await permit(3,bearerA);
  assert.equal(lookups,1);
  clock+=2;
  keys=[B];
  const bearerB=token({now:clock,privateKey:secretB,kid:B.kid});
  await deny(4,bearerA);
  assert.equal(lookups,2,'keys refreshed after 300s');
  await permit(5,bearerB);
  assert.equal(lookups,2);
  clock+=301;
  throwJwks=true;
  await deny(6,bearerB);
  assert.equal(lookups,3,'expired cache fails closed during outage');
  throwJwks=false;
  await permit(7,bearerB);
  assert.equal(lookups,4,'retry fetches valid JWKS');
  values.PRO_PAPA_MCP_RESOURCE=null;
  const unavailable=await netlifyMcp(call(ONE,8,bearerB));
  assert.equal(unavailable.status,503);
  values.PRO_PAPA_MCP_RESOURCE='https://'+ONE;
  await permit(9,bearerB);
  assert.equal(lookups,5,'missing config discarded cached trust');
  values.PRO_PAPA_MCP_PUBLIC_HOSTNAME=TWO;
  values.PRO_PAPA_AUTH0_ISSUER=ISSUER_B;
  values.PRO_PAPA_MCP_RESOURCE='https://'+TWO;
  const next=token({hostname:TWO,issuer:ISSUER_B,privateKey:secretB,kid:B.kid,now:clock});
  await deny(10,bearerB,TWO);
  await permit(11,next,TWO);
  assert.equal(lookups,6,'new issuer/resource creates fresh cache');
 });
});
test('PP-0007 Netlify warm-instance capacity counts concurrent authenticated research to eight',async()=>{
 await withEnv(fixture(TWO,ISSUER_B),async({setFetch,setNow})=>{
  const now=2000000400;
  setNow(()=>now*1000);
  let jwksCalls=0,providerStarted=0,providerPeak=0,active=0;
  const pending=[];
  let ready;
  const eightStarted=new Promise(resolve=>{ready=resolve});
  setFetch(async(url,options)=>{
   if(url===ISSUER_B+'.well-known/jwks.json'){
    jwksCalls++;
    return jwksReply([B]);
   }
   assert.equal(url,'https://api.github.com/repos/Papa3445/Pro-Papa');
   assert.equal(options.method,'GET');
   providerStarted++;
   active++;
   providerPeak=Math.max(providerPeak,active);
   if(providerStarted===8)ready();
   return new Promise(resolve=>pending.push(()=>{
    active--;resolve(githubReply());
   }));
  });
  const jwt=token({hostname:TWO,issuer:ISSUER_B,privateKey:secretB,kid:B.kid,now});
  const requests=Array.from({length:9},(_,i)=>netlifyMcp(call(TWO,100+i,jwt,'research')));
  let timer;
  try{
   await Promise.race([eightStarted,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('eight requests did not reach research fetch')),5000);
   })]);
   const ninth=await output(await requests[8]);
   assert.equal(ninth.isError,true);
   assert.equal(ninth.structuredContent,undefined);
   assert.match(ninth.content[0].text,/bridge at capacity/);
   assert.equal(providerStarted,8);
   assert.equal(providerPeak,8);
   assert.equal(jwksCalls,1);
  }finally{
   clearTimeout(timer);
   for(const release of pending)release();
   await Promise.allSettled(requests);
  }
  for(const reply of await Promise.all(requests.slice(0,8))){
   const result=await output(reply);
   assert.equal(result.isError,false);
   assert.equal(result.structuredContent.trace.state,'released');
   assert.equal(result.structuredContent.execution.output.repository,'Papa3445/Pro-Papa');
  }
  const next=await output(await netlifyMcp(call(TWO,200,jwt)));
  assert.equal(next.isError,false,'released warm slot permits a later local sum');
 });
});
// This confirms only shared state within ONE warm JS module instance.
// It proves neither cross-instance quotas nor any actual production load limit.
