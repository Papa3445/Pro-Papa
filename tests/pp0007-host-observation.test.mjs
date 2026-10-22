import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHostOne, main } from '../bin/pp0007-host-observation.mjs';
import { canonicalTrial } from '../bin/pp0007-api-baseline.mjs';

const repo='Papa3445/Pro-Papa';
const fakeRepo={
  id:1427703038,full_name:repo,private:false,
  html_url:'https://github.com/'+repo,description:'fixture only',
  stargazers_count:7,open_issues_count:1,
};
const stub=()=>{
  const calls=[];
  return {calls,fetchImpl:async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,json:async()=>({...fakeRepo})};
  }};
};

test('host and API baseline load the same frozen canonical objective, capability and inputs',async()=>{
  const trial=await canonicalTrial('data');
  assert.equal(trial.canonicalObjective,'Calculate the total for [2, 3, 5]');
  assert.equal(trial.canonicalCapability,'math.sum');
  assert.deepEqual(trial.canonicalInputs,{numbers:[2,3,5]});
  assert.equal(trial.fixtureGitBlobSha,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
  const host=await runHostOne({id:'data'});
  assert.equal(host.objectiveSha256,trial.objectiveSha256);
  assert.equal(host.inputsSha256,trial.inputsSha256);
  assert.equal(host.fixtureGitBlobSha,trial.fixtureGitBlobSha);
});

test('actual local reference host computes canonical sum without network, audit or artificial grading',async()=>{
  const x=await runHostOne({id:'data'});
  assert.equal(x.transport,'native_reference_host');
  assert.equal(x.resultStatus,'completed');
  assert.equal(x.requestedCapability,'math.sum');
  assert.equal(x.actualCapability,'math.sum');
  assert.deepEqual(x.execution.output,{total:10,count:3});
  assert.equal(x.execution.provenance.provider,'local-node');
  assert.equal(x.githubTransportAttemptsObserved,0);
  assert.equal(x.githubNetworkRequestsIndependentlyConfirmed,null);
  assert.equal(x.auditStatus,'not_requested');
  assert.equal(x.persistenceObserved,false);
  assert.equal(x.taskSuccess,null);
  assert.equal(x.qualityGrade,null);
  assert.equal(x.providerReportedTokens,null);
  assert.ok(Number.isFinite(x.latencyMs)&&x.latencyMs>=0);
});

test('unsupported original objectives remain unsupported; no request may grant itself a handler',async()=>{
  for (const id of ['qa','software','document','planning','novel','research']){
    const x=await runHostOne({id});
    assert.equal(x.resultStatus,'unsupported',id);
    assert.equal(x.execution,null);
    assert.equal(x.githubTransportAttemptsObserved,0);
    assert.equal(x.taskSuccess,null);
    assert.equal(x.auditStatus,'not_requested');
  }
});

test('explicit research grant invokes only fixed allowlisted public GitHub GET, simulation is labeled',async()=>{
  const f=stub();
  const x=await runHostOne({id:'research',githubRead:true,
    mode:'simulation',fetchImpl:f.fetchImpl});
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].url,'https://api.github.com/repos/'+repo);
  assert.equal(f.calls[0].options.method,'GET');
  assert.equal(f.calls[0].options.redirect,'error');
  assert.equal(f.calls[0].options.headers.Authorization,undefined);
  assert.equal(x.transport,'simulated_reference_host_transport');
  assert.equal(x.authenticity,'simulation_only_no_provider_evidence');
  assert.equal(x.resultStatus,'completed');
  assert.equal(x.execution.output.repository,repo);
  assert.equal(x.githubTransportAttemptsObserved,1);
  assert.equal(x.githubNetworkRequestsIndependentlyConfirmed,null);
  assert.equal(x.toolPermissionsComparableToApiBaseline,false);
  assert.equal(x.taskSuccess,null);
});

test('provider rejection is noncompleted, counted as attempted transport and never retried',async()=>{
  let count=0;
  const x=await runHostOne({id:'research',githubRead:true,mode:'simulation',
    fetchImpl:async()=>{count++;throw Error('provider secret not for logs')}});
  assert.equal(count,1);
  assert.equal(x.githubTransportAttemptsObserved,1);
  assert.equal(x.resultStatus,'provider_unavailable');
  assert.equal(x.execution,null);
  assert.ok(!JSON.stringify(x).includes('provider secret'));
});

test('injected transports cannot claim native provider observations',async()=>{
  const f=stub();
  await assert.rejects(runHostOne({id:'research',githubRead:true,
    fetchImpl:f.fetchImpl}),/Invalid PP-0007/);
  await assert.rejects(runHostOne({id:'research',githubRead:true,
    mode:'simulation'}),/Invalid PP-0007/);
  await assert.rejects(runHostOne({id:'data',githubRead:true}),/Invalid PP-0007/);
  await assert.rejects(runHostOne({id:'forged'}),/Invalid PP-0007/);
  assert.equal(f.calls.length,0);
});

test('CLI refuses missing authorization, unknown options, wrong research grant, and relative output',async()=>{
  const invalid=[
    [],
    ['--case','data','--out','/tmp/trial.json'],
    ['--execute','--case','data','--out','relative.json'],
    ['--execute','--case','data','--out','/tmp/trial.json','--github-read'],
    ['--execute','--case','qa','--out','/tmp/trial.json','--github-read'],
    ['--execute','--case','data','--out','/tmp/trial.json','--approve-issue'],
    ['--execute','--execute','--case','data','--out','/tmp/trial.json'],
    ['--execute','--case','bogus','--out','/tmp/trial.json'],
  ];
  for(const argv of invalid)await assert.rejects(main(argv,()=>{}),/Invalid PP-0007/);
});

test('CLI persists actual host observation only in new 0600 private file and never overwrites',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pp0007-host-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const output=join(dir,'data.json'),stdout=[];
  const result=await main(['--execute','--case','data','--out',output],
    x=>stdout.push(JSON.parse(x)));
  assert.equal(result.resultStatus,'completed');
  assert.equal(stdout.length,1);
  assert.equal(stdout[0].status,'host_observation_saved');
  assert.equal(stdout[0].taskSuccess,null);
  const saved=JSON.parse(await readFile(output,'utf8'));
  assert.deepEqual(saved.execution.output,{total:10,count:3});
  assert.equal(saved.authenticity,'local_host_execution_not_independent_quality_grade');
  const mode=(await stat(output)).mode&0o777;
  assert.equal(mode,0o600);
  await assert.rejects(main(['--execute','--case','data','--out',output],()=>{}),{code:'EEXIST'});
  assert.equal((await readFile(output,'utf8')).includes('"total": 10'),true);
});
