import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createOAuthResourceValidator} from '../src/oauth-resource.mjs';

const ISSUER='https://personal-fixture.us.auth0.com/';
const RESOURCE='https://pro-papa-fixture.netlify.app';
const SCOPE='pro_papa.read';
const NOW=2000000000;
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'pro-papa-fixture-2026',
  use:'sig',alg:'RS256'};
const header={alg:'RS256',kid:jwk.kid,typ:'JWT'};
const claims={iss:ISSUER,aud:RESOURCE,exp:NOW+3600,iat:NOW-60,
  nbf:NOW-60,sub:'auth0|fixture-uid',scope:'openid profile pro_papa.read'};
const part=x=>Buffer.from(JSON.stringify(x),'utf8').toString('base64url');
const signed=(c=claims,h=header,priv=privateKey)=>{
  const first=part(h)+'.'+part(c);
  return first+'.'+sign('RSA-SHA256',Buffer.from(first),priv).toString('base64url');
};
const fixture=(opts={})=>{
 let fetches=0;
 const server=createOAuthResourceValidator({
   issuer:ISSUER,resource:RESOURCE,now:()=>NOW,
   fetchImpl:async(url,request)=>{
     fetches++;
     assert.equal(url,ISSUER+'.well-known/jwks.json');
     assert.equal(request.redirect,'error');
     return new Response(JSON.stringify({keys:[jwk]}),{
       headers:{'Content-Type':'application/json'}});
   },
   ...opts
 });
 return {server,fetches:()=>fetches};
};

test('PP-0007 Auth0 metadata advertises exact protected resource and issuer without network',async()=>{
 const x=fixture();
 assert.deepEqual(x.server.metadata(),{
   resource:RESOURCE,authorization_servers:[ISSUER],scopes_supported:[SCOPE]
 });
 const response=x.server.metadataResponse();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),x.server.metadata());
 const unauthorized=x.server.unauthorizedResponse();
 assert.equal(unauthorized.status,401);
 assert.match(unauthorized.headers.get('www-authenticate'),/resource_metadata="https:\/\/pro-papa-fixture.netlify.app\/\.well-known\/oauth-protected-resource"/);
 assert.match(unauthorized.headers.get('www-authenticate'),/scope="pro_papa.read"/);
 assert.match(x.server.challenge('insufficient_scope'),/error="insufficient_scope"/);
 assert.equal(x.fetches(),0);
});

test('PP-0007 Auth0 verifies actual RS256 signature, audience, scope, issuer and caches trusted JWKS',async()=>{
 const x=fixture();
 assert.equal(await x.server.verifyAuthorization('Bearer '+signed()),true);
 assert.equal(x.fetches(),1);
 assert.equal(await x.server.verifyAuthorization('Bearer '+signed({...claims,aud:[RESOURCE,ISSUER+'userinfo']})),true);
 assert.equal(x.fetches(),1);
 const bad=[
   {...claims,iss:'https://attacker.auth0.com/'},
   {...claims,iss:ISSUER.slice(0,-1)},
   {...claims,aud:'https://different.netlify.app'},
   {...claims,aud:[ISSUER+'userinfo']},
   {...claims,aud:Array(9).fill(RESOURCE)},
   {...claims,exp:NOW},
   {...claims,exp:NOW-120},
   {...claims,exp:'2000000030'},
   {...claims,iat:NOW+1000},
   {...claims,nbf:NOW+200},
   {...claims,sub:''},
   {...claims,scope:'openid other.permission'},
   {...claims,scope:['pro_papa.read']},
 ];
 for(const c of bad)assert.equal(await x.server.verifyAuthorization('Bearer '+signed(c)),false,
   'reject '+JSON.stringify(c).slice(0,120));
 assert.equal(x.fetches(),1);
});

test('PP-0007 Auth0 rejects forged token signatures, key injection, alg downgrade and wrong kid',async()=>{
 const x=fixture();
 const rogue=generateKeyPairSync('rsa',{modulusLength:2048});
 const samples=[
   signed(claims,header,rogue.privateKey),
   signed(claims,{...header,alg:'none'}),
   signed(claims,{...header,alg:'HS256'}),
   signed(claims,{...header,kid:'unknown'}),
   signed(claims,{...header,jku:'https://attacker.invalid/jwks.json'}),
   signed(claims,{...header,jwk:rogue.publicKey.export({format:'jwk'})}),
   signed(claims,{...header,x5u:'https://attacker.invalid/cert'}),
   signed(claims,{...header,crit:['b64']})
 ];
 for(const token of samples)assert.equal(await x.server.verifyAuthorization('Bearer '+token),false);
 assert.equal(x.fetches(),1);
});

test('PP-0007 Auth0 rejects incomplete and oversized tokens without JWKS fetch or text leaks',async()=>{
 const x=fixture();
 const samples=[null,'','Basic abc','Bearer ',
 'Bearer x','Bearer a.b','Bearer a.b.c.d',
 'Bearer '+('x'.repeat(40000)),
 'Bearer '+part({...header,kid:'../../escape'})+'.'+part(claims)+'.x',
 'Bearer '+part(header)+'.'+part({...claims,exp:Infinity})+'.x'
 ];
 for(const auth of samples)assert.equal(await x.server.verifyAuthorization(auth),false);
 assert.equal(x.fetches(),0);
});

test('PP-0007 Auth0 rejects invalid JWKS, 1024-bit RSA, HTTP errors and redirects',async()=>{
 const variants=[
   new Response('nope',{status:500}),
   new Response(JSON.stringify({keys:[]}),{headers:{'Content-Type':'application/json'}}),
   new Response(JSON.stringify({keys:[{...jwk,kid:'different',alg:'HS256'}]}),{
     headers:{'Content-Type':'application/json'}}),
   new Response(JSON.stringify({keys:[jwk,jwk]}),{
     headers:{'Content-Type':'application/json'}}),
   new Response(JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'text/html'}}),
   new Response('x'.repeat(40000),{headers:{'Content-Type':'application/json'}})
 ];
 const weak=generateKeyPairSync('rsa',{modulusLength:1024}).publicKey.export({format:'jwk'});
 variants.push(new Response(JSON.stringify({keys:[{...weak,kid:jwk.kid,alg:'RS256'}]}),{
   headers:{'Content-Type':'application/json'}}));
 for(const response of variants){
   const verifier=createOAuthResourceValidator({issuer:ISSUER,resource:RESOURCE,
     now:()=>NOW,fetchImpl:async()=>response.clone()});
   assert.equal(await verifier.verifyAuthorization('Bearer '+signed()),false);
 }
});

test('PP-0007 Auth0 rejects noncanonical issuer, audience, unknown host and insecure metadata',()=>{
 const noNetwork=async()=>{throw Error('network must not execute during creation')};
 const configs=[
   {issuer:'http://personal-fixture.us.auth0.com/'},
   {issuer:'https://evil.example/'},
   {issuer:'https://personal-fixture.us.auth0.com'},
   {issuer:'https://personal-fixture.us.auth0.com/extra'},
   {issuer:'https://personal-fixture.us.auth0.com/?a=1'},
   {resource:'http://pro-papa-fixture.netlify.app'},
   {resource:RESOURCE+'/mcp'},
   {resource:RESOURCE+'/'},
   {resource:'https://user:pass@pro-papa-fixture.netlify.app'},
   {scope:'admin read'},
   {cacheSeconds:100000}
 ];
 for(const c of configs)assert.throws(()=>createOAuthResourceValidator({
   issuer:ISSUER,resource:RESOURCE,fetchImpl:noNetwork,...c
 }),/configuration/);
});

test('PP-0007 Auth0 JWKS cache expires and refreshes only from pinned HTTPS tenant URL',async()=>{
 let seconds=NOW,calls=0;
 const verifier=createOAuthResourceValidator({issuer:ISSUER,resource:RESOURCE,
   now:()=>seconds,cacheSeconds:60,fetchImpl:async()=>{
     calls++;
     return new Response(JSON.stringify({keys:[jwk]}),{
       headers:{'Content-Type':'application/json'}});
   }});
 assert.equal(await verifier.verifyAuthorization('Bearer '+signed()),true);
 assert.equal(await verifier.verifyAuthorization('Bearer '+signed()),true);
 assert.equal(calls,1);
 seconds+=61;
 assert.equal(await verifier.verifyAuthorization('Bearer '+signed()),true);
 assert.equal(calls,2);
});
