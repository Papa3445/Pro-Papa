import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createReadOnlyMcpWebHandler} from '../src/mcp-web.mjs';
import {createOAuthResourceValidator} from '../src/oauth-resource.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const HOST='pro-papa-fixture.netlify.app';
const RESOURCE='https://'+HOST;
const ISSUER='https://fixture-auth0.us.auth0.com/';
const BASE=RESOURCE+'/mcp';
const JSONHEADERS={'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const publicJwk={...publicKey.export({format:'jwk'}),kid:'test-kid-1',use:'sig',alg:'RS256'};
const now=2000000000;
const basic={iss:ISSUER,aud:RESOURCE,iat:now-60,nbf:now-60,exp:now+3600,
  sub:'auth0|fixture-user',scope:'openid pro_papa.read'};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const signed=(claims=basic,header={alg:'RS256',kid:'test-kid-1',typ:'JWT'})=>{
  const data=b64(header)+'.'+b64(claims);
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
};
const request=(payload,authorization,opts={})=>new Request(opts.url??BASE,{
  method:'POST',headers:{...JSONHEADERS,...(authorization?{Authorization:authorization}:{}),...opts.headers},
  body:JSON.stringify(payload)});
const call=(method,id,params)=>({jsonrpc:'2.0',id,method,params});
const run=(capability,inputs)=>call('tools/call',3,{name:'pro_papa_execute_readonly',
  arguments:{objective:'Verify OAuth MCP execution gate',capability,inputs}});
function gateway(extra={}){
  let keys=0,github=0;
  const validator=createOAuthResourceValidator({issuer:ISSUER,resource:RESOURCE,
    now:()=>now,fetchImpl:async url=>{
      keys++;
      assert.equal(url,ISSUER+'.well-known/jwks.json');
      return new Response(JSON.stringify({keys:[publicJwk]}),
        {headers:{'Content-Type':'application/json'}});
    }});
  const fetchImpl=async()=>{github++;return {ok:true,status:200,json:async()=>({
    full_name:'Papa3445/Pro-Papa',id:1427703038,private:false,
    description:'Fixture',stargazers_count:2,open_issues_count:0,
    html_url:'https://github.com/Papa3445/Pro-Papa'
  })};};
  const app=createReadOnlyMcpWebHandler({
    hostname:HOST,oauthValidator:validator,githubResearch:true,
    allowRepositories:['Papa3445/Pro-Papa'],fetchImpl,...extra
  });
  return {app,validator,counts:()=>({jwks:keys,github})};
}

test('PP-0007 OAuth MCP exposes public RFC9728 protected-resource metadata and keeps host locked',async()=>{
  const {app}=gateway();
  const meta=await app(new Request(RESOURCE+'/.well-known/oauth-protected-resource'));
  assert.equal(meta.status,200);
  assert.deepEqual(await meta.json(),{resource:RESOURCE,authorization_servers:[ISSUER],
    scopes_supported:['pro_papa.read']});
  assert.equal((await app(new Request('http://'+HOST+'/.well-known/oauth-protected-resource'))).status,404);
  assert.equal((await app(new Request(RESOURCE+'/.well-known/oauth-protected-resource?x=1'))).status,404);
  assert.equal((await app(new Request(RESOURCE+'/.well-known/oauth-protected-resource',{
    headers:{Host:'attacker.example'}}))).status,403);
  assert.equal((await app(new Request(RESOURCE+'/.well-known/oauth-protected-resource',{
    headers:{Origin:'https://attacker.example'}}))).status,403);
  assert.equal((await app(request({},null,{url:RESOURCE+'/.well-known/oauth-protected-resource'}))).status,405);
});

test('PP-0007 OAuth MCP discovers tools anonymously with explicit required scope',async()=>{
  const {app,counts}=gateway();
  const init=await app(request(call('initialize',1,{protocolVersion:'2025-11-25'})));
  assert.equal(init.status,200);
  assert.equal((await init.json()).result.protocolVersion,'2025-11-25');
  const listing=await app(request(call('tools/list',2,{})));
  assert.equal(listing.status,200);
  const tools=(await listing.json()).result.tools;
  assert.equal(tools.length,1);
  assert.deepEqual(tools[0].securitySchemes,[{type:'oauth2',scopes:['pro_papa.read']}]);
  assert.equal(tools[0].annotations.readOnlyHint,true);
  assert.equal(counts().jwks,0);
});

test('PP-0007 OAuth MCP returns linking metadata but never executes unauthenticated tool calls',async()=>{
  const {app,counts}=gateway();
  for(const auth of [undefined,'Bearer wrong','Basic other']){
    const res=await app(request(run('research',{repository:'Papa3445/Pro-Papa'}),auth));
    assert.equal(res.status,200);
    const result=(await res.json()).result;
    assert.equal(result.isError,true);
    assert.equal(result.structuredContent,undefined);
    assert.equal(result.content[0].text,'Authentication required');
    const hint=result._meta['mcp/www_authenticate'];
    assert.equal(hint.length,1);
    assert.match(hint[0],/resource_metadata="https:\/\/pro-papa-fixture.netlify.app\/\.well-known\/oauth-protected-resource"/);
    assert.match(hint[0],/error_description="Authenticate to use the Pro-Papa read-only tool"/);
    assert.equal(counts().github,0);
  }
});

test('PP-0007 OAuth MCP validates a genuinely signed RS256 bearer token before executing host',async()=>{
  const {app,counts}=gateway();
  const res=await app(request(run('math.sum',{numbers:[2,3,5]}),'Bearer '+signed()));
  assert.equal(res.status,200);
  const outcome=(await res.json()).result;
  assert.equal(outcome.isError,false);
  assert.equal(outcome.structuredContent.execution.output.total,10);
  assert.equal(verifyReleasedExecution(outcome.structuredContent),true);
  assert.equal(counts().jwks,1);
  assert.equal(counts().github,0);
});

test('PP-0007 OAuth MCP rejects tampered, wrong audience and insufficient scope, then permits only authorized research',async()=>{
  const {app,counts}=gateway();
  const invalid=[
    signed({...basic,aud:'https://attacker.example'}),
    signed({...basic,scope:'openid other.read'}),
    signed({...basic,exp:now}),
    signed().slice(0,-3)+'aaa'
  ];
  for(const token of invalid){
    const res=await app(request(run('research',{repository:'Papa3445/Pro-Papa'}),'Bearer '+token));
    assert.equal((await res.json()).result.isError,true);
    assert.equal(counts().github,0);
  }
  const valid=await app(request(run('research',{repository:'Papa3445/Pro-Papa'}),'Bearer '+signed()));
  const data=(await valid.json()).result;
  assert.equal(data.isError,false);
  assert.equal(verifyReleasedExecution(data.structuredContent),true);
  assert.equal(data.structuredContent.execution.output.repository,'Papa3445/Pro-Papa');
  assert.equal(counts().github,1);
});

test('PP-0007 OAuth mode cannot silently accept a fixed legacy token or a mismatched resource',()=>{
  const validator=createOAuthResourceValidator({issuer:ISSUER,resource:RESOURCE,
    fetchImpl:async()=>{throw Error('Not called')}});
  assert.throws(()=>createReadOnlyMcpWebHandler({
    hostname:HOST,oauthValidator:validator,bearerToken:'supersecret-very-long-static-legacy-key'
  }),/configuration/);
  assert.throws(()=>createReadOnlyMcpWebHandler({
    hostname:'attacker.example',oauthValidator:validator
  }),/configuration/);
  assert.throws(()=>createReadOnlyMcpWebHandler({
    hostname:HOST,oauthValidator:{metadata:()=>({resource:RESOURCE,
      scopes_supported:['pro_papa.read']})}
  }),/configuration/);
});
