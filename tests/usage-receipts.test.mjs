import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { issueUsageReceipt, validateUsageOptions } from '../src/usage-receipts.mjs';

const source='Papa3445/Pro-Papa',store='Papa3445/Pro-Papa-Audit',sha='a'.repeat(40),commit='b'.repeat(40);
const sourceContent={
  'AGENTS.md':'# Pro-Papa — AI Operating Contract\nThis source is a test fixture.\n',
  '.pro-papa/profiles.json':JSON.stringify({schemaVersion:1,profiles:{general:{requiredEvidence:['artifact','review']}}}),
};
const uuid='12345678-1234-4123-8123-123456789abc';
function file(path,content){
  const bytes=Buffer.from(content);
  return {type:'file',path,size:bytes.length,encoding:'base64',content:bytes.toString('base64'),
    sha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')};
}
function fixture(options={}){
  const calls=[], saved=[], receiptFiles=new Map();
  let publicStore=Boolean(options.publicStore);
  const api=async(url,request)=>{
    const uri=new URL(url),path=uri.pathname+uri.search;
    calls.push({path,method:request.method});
    let output,status=200;
    if(request.method==='GET' && path==='/repos/'+store) {
      output={full_name:store,private:!publicStore,default_branch:'main'};
    } else if(request.method==='GET' && path==='/repos/'+source+'/commits/main') {
      output={sha};
    } else if(request.method==='GET' && path.startsWith('/repos/'+source+'/contents/')){
      const pathName=decodeURIComponent(path.slice(('/repos/'+source+'/contents/').length).split('?')[0]);
      const text=sourceContent[pathName];
      if(!text)throw Error('Unexpected source read '+path);
      output=file(pathName,options.sourceTamper&&pathName==='AGENTS.md' ? text+'tampered' : text);
      if(options.invalidBlob&&pathName==='AGENTS.md')output.sha='c'.repeat(40);
    } else if(request.method==='PUT' && path.startsWith('/repos/'+store+'/contents/')){
      if(options.failWrite)return {ok:false,status:403,json:async()=>({message:'denied'})};
      const data=JSON.parse(request.body),name=path.slice(('/repos/'+store+'/contents/').length);
      assert.equal(data.branch,'main');
      assert.equal(data.sha,undefined,'PUT must never overwrite existing receipts');
      const content=Buffer.from(data.content,'base64').toString('utf8');
      if(receiptFiles.has(name))return {ok:false,status:409,json:async()=>({message:'conflict'})};
      if(options.publicBeforeWrite)publicStore=true;
      receiptFiles.set(name,content);saved.push({name,content});
      const blobSha=options.forgedMatchingBlob?'c'.repeat(40):file(name,content).sha;
      output={commit:{sha:commit},content:{sha:blobSha,path:name}};
    } else if(request.method==='GET' && path.startsWith('/repos/'+store+'/contents/')){
      const suffix=path.slice(('/repos/'+store+'/contents/').length),name=suffix.split('?')[0];
      assert.equal(uri.searchParams.get('ref'),commit);
      const contents=receiptFiles.get(name);
      assert.ok(contents);
      output=file(name,options.tamperReadback?contents+'altered':contents);
      if(options.forgedMatchingBlob)output.sha='c'.repeat(40);
      if(options.publicAfterReadback)publicStore=true;
    } else throw Error('Unexpected request '+request.method+' '+path);
    return {ok:status===200,status,json:async()=>output};
  };
  const invoke=(overrides={})=>issueUsageReceipt({sourceRepository:source,storeRepository:store,sourceRef:'main',
    token:'test-token',fetchImpl:api,uuid:()=>uuid,now:()=> '2026-10-21T12:00:00.000Z',...overrides});
  return {calls,saved,invoke};
}
test('issue receipt reads exact GitHub bytes and verifies a private Git commit',async()=>{
  const f=fixture(),r=await f.invoke();
  assert.equal(r.status,'confirmed');
  assert.equal(r.sourceCommit,sha);
  assert.equal(r.receiptCommit,commit);
  assert.equal(r.visibility,'private');
  assert.equal(r.consulted.length,2);
  assert.match(r.receiptUrl,/blob\/b{40}\/usage-receipts\/2026\/10\/12345678-1234-4123-8123-123456789abc.json$/);
  assert.equal(f.saved.length,1);
  assert.equal(f.calls.filter(x=>x.method==='PUT').length,1);
  const record=JSON.parse(f.saved[0].content);
  assert.deepEqual(Object.keys(record).sort(),['consulted','operation','receiptId','recordedAt','schemaVersion','sourceCommit','sourceRepository','verificationScope'].sort());
  assert.ok(!f.saved[0].content.includes('prompt')&&!f.saved[0].content.includes('conversation'));
  assert.equal(record.sourceCommit,sha);
  assert.ok(f.calls.filter(x=>x.method==='GET').some(x=>x.path.endsWith('?ref='+sha)));
});
test('never write to public or same-source repository',async()=>{
  const f=fixture({publicStore:true});
  await assert.rejects(f.invoke(),/must exist.*private/);
  assert.equal(f.calls.length,1);
  assert.equal(f.saved.length,0);
  assert.throws(()=>validateUsageOptions({sourceRepository:source,storeRepository:source}),/separate/);
});
test('invalid repository and source-ref selectors are rejected before requests',async()=>{
  const f=fixture();
  for(const opts of [
    {sourceRepository:'https://example.com'}, {storeRepository:'evil/.\\nname'},
    {sourceRef:'../main'}, {sourceRef:'main?file=bad'}, {sourceRef:'//main'},
  ]) await assert.rejects(f.invoke(opts),/Invalid/);
  assert.equal(f.calls.length,0);
});
test('source identity mismatch fails closed without receipt write',async()=>{
  const f=fixture({invalidBlob:true});
  await assert.rejects(f.invoke(),/hash\/path mismatch/);
  assert.equal(f.saved.length,0);
});
test('provider write error or readback corruption never reports confirmed',async()=>{
  const badWrite=fixture({failWrite:true});
  await assert.rejects(badWrite.invoke(),/HTTP 403/);
  const altered=fixture({tamperReadback:true});
  await assert.rejects(altered.invoke(),/readback did not match/);
  assert.equal(altered.saved.length,1);
});
test('missing token or untrusted UUID and timestamp do not publish',async()=>{
  const f=fixture();
  await assert.rejects(f.invoke({token:''}),/GITHUB_TOKEN/);
  await assert.rejects(f.invoke({uuid:()=> '../bad.json'}),/Invalid receipt UUID/);
  await assert.rejects(f.invoke({now:()=> 'invalid'}),/Invalid receipt timestamp/);
  assert.equal(f.saved.length,0);
});
test('readback verification requires exact commit and payload',async()=>{
  const f=fixture();await f.invoke();
  assert.deepEqual(f.calls.map(x=>x.method),['GET','GET','GET','GET','GET','PUT','GET','GET']);
  assert.ok(f.calls[0].path.endsWith(store));
  assert.ok(f.calls.at(-1).path.includes('?ref='+commit));
});

test('privacy race after prewrite check fails closed after committing',async()=>{
  const f=fixture({publicBeforeWrite:true});
  await assert.rejects(f.invoke(),/remain private/);
  assert.equal(f.saved.length,1,'the receipt may already be written during the race');
  assert.equal(f.calls.at(-1).path,'/repos/'+store);
});
test('public switch at readback fails closed',async()=>{
  const f=fixture({publicAfterReadback:true});
  await assert.rejects(f.invoke(),/remain private/);
  assert.equal(f.saved.length,1);
});
test('matching but fabricated PUT and GET blob identities are rejected',async()=>{
  const f=fixture({forgedMatchingBlob:true});
  await assert.rejects(f.invoke(),/matching receipt blob/);
  assert.equal(f.saved.length,1);
});
test('invalid calendar dates and noncanonical timestamps are rejected',async()=>{
  for(const time of ['2026-02-30T12:00:00.000Z','2026-13-01T12:00:00.000Z',
    '2026-10-21T12:00:00Z','2026-10-21T12:00:00.0000Z',
    '2026-10-21T24:00:00.000Z']) {
    const f=fixture();
    await assert.rejects(f.invoke({now:()=>time}),/Invalid receipt timestamp/,time);
    assert.equal(f.saved.length,0,time);
  }
});
