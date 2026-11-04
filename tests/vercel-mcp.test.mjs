import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vercelMcp from '../api/mcp.mjs';
import {renderMetadata,writeMetadata} from '../bin/render-vercel-oauth-metadata.mjs';

const HOST='pp-vercel-fixture.vercel.app';
const ISSUER='https://pp-vercel-fixture.us.auth0.com/';
const RESOURCE='https://'+HOST;
const CONFIG={PRO_PAPA_MCP_PUBLIC_HOSTNAME:HOST,
  PRO_PAPA_AUTH0_ISSUER:ISSUER,PRO_PAPA_MCP_RESOURCE:RESOURCE};
const HEADERS={'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
const oldKeys=['PRO_PAPA_MCP_PUBLIC_HOSTNAME','PRO_PAPA_AUTH0_ISSUER',
  'PRO_PAPA_MCP_RESOURCE','PRO_PAPA_MCP_ARTIFACT_VALIDATION'];
function withEnv(config,fn){
  const old=Object.fromEntries(oldKeys.map(x=>[x,process.env[x]]));
  for(const key of oldKeys){
    if(Object.hasOwn(config,key))process.env[key]=config[key];
    else delete process.env[key];
  }
  return Promise.resolve().then(fn).finally(()=>{
    for(const key of oldKeys){
      if(old[key]===undefined)delete process.env[key];
      else process.env[key]=old[key];
    }
  });
}
const call=(url,token)=>new Request(url,{method:'POST',headers:{...HEADERS,
  ...(token?{Authorization:'Bearer '+token}:{})},
  body:JSON.stringify({jsonrpc:'2.0',id:8,method:'tools/call',params:{
    name:'pro_papa_execute_readonly',arguments:{
      objective:'Vercel staging math regression',capability:'math.sum',inputs:{numbers:[2,3,5]}
    }
  }})});

test('Vercel OAuth metadata is static, public, exact and fails closed',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
  assert.deepEqual(config.rewrites,[{source:'/mcp',destination:'/api/mcp'}]);
  assert.ok(config.rewrites.every(x=>!x.source.startsWith('/.well-known')));
  assert.ok(config.headers.some(x=>x.source==='/.well-known/oauth-protected-resource'&&
    x.headers.some(y=>y.key==='Content-Type'&&y.value.startsWith('application/json'))));
  const json=JSON.parse(renderMetadata(CONFIG));
  assert.deepEqual(json,{resource:RESOURCE,authorization_servers:[ISSUER],
    scopes_supported:['pro_papa.read']});
  assert.throws(()=>renderMetadata({...CONFIG,PRO_PAPA_MCP_RESOURCE:'https://other.vercel.app'}));
  assert.throws(()=>renderMetadata({...CONFIG,PRO_PAPA_AUTH0_ISSUER:'https://attacker.invalid/'}));
  const tmp=mkdtempSync(join(tmpdir(),'pro-papa-vercel-'));
  try{
    const path=writeMetadata({env:CONFIG,outputDir:tmp});
    assert.equal(path,join(tmp,'.well-known','oauth-protected-resource'));
    assert.equal(readFileSync(path,'utf8'),renderMetadata(CONFIG));
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('Vercel handler denies unavailable configuration and unauthorized hosts',async()=>{
  await withEnv({},async()=>{
    const response=await vercelMcp.fetch(call(RESOURCE+'/api/mcp'));
    assert.equal(response.status,503);
    assert.equal(response.headers.get('cache-control'),'no-store');
  });
  await withEnv(CONFIG,async()=>{
    const response=await vercelMcp.fetch(call('https://attacker.invalid/api/mcp'));
    assert.equal(response.status,404);
  });
  await withEnv({...CONFIG,PRO_PAPA_MCP_ARTIFACT_VALIDATION:'YES'},async()=>{
    assert.equal((await vercelMcp.fetch(call(RESOURCE+'/api/mcp'))).status,503);
  });
});

test('Vercel Node fetch adapter preserves OAuth signature gate and MCP execution',async()=>{
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const kid='vercel-fixture-key';
  const jwk={...publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'};
  const now=Math.floor(Date.now()/1000);
  const part=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const signingInput=part({alg:'RS256',typ:'JWT',kid})+'.'+part({
    iss:ISSUER,aud:RESOURCE,iat:now-60,nbf:now-60,exp:now+3600,
    sub:'fixture|vercel',scope:'pro_papa.read'
  });
  const bearer=signingInput+'.'+sign('RSA-SHA256',Buffer.from(signingInput),privateKey)
    .toString('base64url');
  const originalFetch=globalThis.fetch;
  const previousGithubToken=process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN='test-ambient-token-must-never-leak';
  let lookedUp=0;
  let githubLookups=0;
  try{
    globalThis.fetch=async (url,options={})=>{
      if(url===ISSUER+'.well-known/jwks.json'){
        lookedUp++;
        return new Response(JSON.stringify({keys:[jwk]}),{
          status:200,headers:{'Content-Type':'application/json'}
        });
      }
      if(url==='https://api.github.com/repos/Papa3445/Pro-Papa'){
        githubLookups++;
        assert.equal(options.method,'GET');
        assert.equal(options.headers?.Authorization,undefined,
          'staging research must never inherit ambient GITHUB_TOKEN');
        return new Response(JSON.stringify({
          id:31415,full_name:'Papa3445/Pro-Papa',html_url:'https://github.com/Papa3445/Pro-Papa',
          private:false,stargazers_count:2,open_issues_count:1,description:'Fixture'
        }),{status:200,headers:{'Content-Type':'application/json'}});
      }
      throw new Error('Unexpected network request in Vercel adapter fixture');
    };
    await withEnv(CONFIG,async()=>{
      const denied=await vercelMcp.fetch(call(RESOURCE+'/api/mcp','invalid'));
      assert.equal(denied.status,200);
      assert.equal((await denied.json()).result.isError,true);
      const response=await vercelMcp.fetch(call(RESOURCE+'/api/mcp',bearer));
      assert.equal(response.status,200);
      const result=(await response.json()).result;
      assert.equal(result.isError,false);
      assert.equal(result.structuredContent.execution.output.total,10);
      assert.equal(result.structuredContent.trace.state,'released');
      assert.equal(lookedUp,1);
      const reply=await vercelMcp.fetch(call(RESOURCE+'/api/mcp',bearer));
      assert.equal((await reply.json()).result.structuredContent.execution.output.total,10);
      assert.equal(lookedUp,1,'warm JWKS reused for unchanged configuration');

      // A nonsecret public-repo read must not pick up an ambient provider credential.
      const research=await vercelMcp.fetch(new Request(RESOURCE+'/api/mcp',{
        method:'POST',headers:{...HEADERS,Authorization:'Bearer '+bearer},
        body:JSON.stringify({jsonrpc:'2.0',id:9,method:'tools/call',params:{
          name:'pro_papa_execute_readonly',arguments:{
            objective:'Public repository metadata without credentials',
            capability:'research',inputs:{repository:'Papa3445/Pro-Papa'}
          }
        }})
      }));
      assert.equal(research.status,200);
      const resultResearch=(await research.json()).result;
      assert.equal(resultResearch.isError,false);
      assert.equal(resultResearch.structuredContent.execution.output.repository,'Papa3445/Pro-Papa');
      assert.equal(githubLookups,1);
      assert.equal(lookedUp,1);
    });
  }finally{
    globalThis.fetch=originalFetch;
    if(previousGithubToken===undefined)delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN=previousGithubToken;
  }
});
