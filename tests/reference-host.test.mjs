import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, loadProject } from '../src/core.mjs';
import { createReferenceHost, issueApprovalDigest } from '../src/reference-host.mjs';
import {verifyReleasedExecution,releaseExecutionTrace} from '../src/execution-trace.mjs';

const repository = 'Papa3445/Pro-Papa', store = 'Papa3445/Pro-Papa-Audit';
const sha = 'a'.repeat(40), commit = 'b'.repeat(40);
const id = '8a0dc3bd-e94f-427a-a277-aaabf621047b';
const request = { id, objective: 'Research this repository', capability: 'research',
  inputs: { repository } };
const issueRequest = { id, objective: 'Create authorized issue', capability: 'operations',
  inputs: { repository, action: 'github.create_issue', title: 'Verified host fixture', body: 'No secrets' } };
const approvedIssue={requestId:id,repository,
  payloadSha256:issueApprovalDigest({requestId:id,repository,
    title:'Verified host fixture',body:'No secrets'})};
function resource(path, content) {
  const bytes = Buffer.from(content);
  return { type:'file', path, size: bytes.length, encoding:'base64',
    content: bytes.toString('base64'),
    sha:createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex') };
}
const source = {
  'AGENTS.md': '# Pro-Papa — AI Operating Contract\nValid private audit fixture.\n',
  '.pro-papa/profiles.json': JSON.stringify({ schemaVersion:1,
    profiles:{ general:{ requiredEvidence:['artifact','review'] } } }),
};
function service({ privateStore=true, corruptReadback=false, failAuditWrite=false,
  failResearch=false, failEffect=false, publicAfterWrite=false }={}) {
  const calls=[], receipts=new Map();
  let isPrivate=privateStore;
  const fetchImpl=async(url, init={})=>{
    const u=new URL(url),path=u.pathname,method=init.method ?? 'GET';
    calls.push({path,method,url,redirect:init.redirect,body:init.body,
      authorization:init.headers?.Authorization});
    let data,status=200;
    if(path==='/repos/'+store && method==='GET') {
      data={full_name:store,private:isPrivate,default_branch:'main'};
    } else if(path==='/repos/'+repository+'/commits/main') {
      data={sha};
    } else if(path.startsWith('/repos/'+repository+'/contents/')) {
      const name=path.slice(('/repos/'+repository+'/contents/').length);
      if(!source[name])throw Error('Unexpected source '+name);
      data=resource(name,source[name]);
    } else if(path.startsWith('/repos/'+store+'/contents/')) {
      const name=path.slice(('/repos/'+store+'/contents/').length);
      if(method==='PUT') {
        if(failAuditWrite)return {ok:false,status:403,json:async()=>({})};
        const payload=JSON.parse(init.body);
        const raw=Buffer.from(payload.content,'base64').toString('utf8');
        receipts.set(name,raw);
        data={commit:{sha:commit},content:{sha:resource(name,raw).sha,path:name}};
        if(publicAfterWrite)isPrivate=false;
      } else {
        assert.equal(u.searchParams.get('ref'),commit);
        const raw=receipts.get(name);
        if(raw===undefined)throw Error('Unwritten receipt');
        data=resource(name,corruptReadback?raw+'tampered':raw);
      }
    } else if(path==='/repos/'+repository && method==='GET') {
      if(failResearch)return {ok:false,status:503,json:async()=>({})};
      data={full_name:repository,id:1427703038,private:false,stargazers_count:6,
        open_issues_count:1,description:'Verified mock repo',
        html_url:'https://github.com/'+repository};
    } else if(path==='/repos/'+repository+'/issues' && method==='POST') {
      if(failEffect)return {ok:false,status:503,json:async()=>({})};
      data={number:22,html_url:'https://github.com/'+repository+'/issues/22'};
      status=201;
    } else throw Error('Unexpected provider call '+method+' '+path);
    return {ok:true,status,json:async()=>data};
  };
  return {calls,receipts,fetchImpl};
}
async function project(t) {
  const dir=await mkdtemp(join(tmpdir(),'pp-ref-host-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await initializeProject(dir,'Isolated PP-0006 host project');
  return dir;
}
const durable=async(t,options={})=>({ durableProject:await project(t),
  durableSecret:'a-locally-managed-durable-secret-123456', ...options });
const config=(mock,overrides={})=>({
  allowedRepositories:[repository],githubResearch:true,token:'fixture-private-token',
  fetchImpl:mock.fetchImpl,
  ...(overrides.auditMode === 'required' ? {
    auditTransport:'simulation',auditFetchImpl:mock.fetchImpl } : {}),
  ...overrides,
});

test('reference host executes real local math/text handlers and rejects missing providers',async()=>{
  const f=service(),host=createReferenceHost({fetchImpl:f.fetchImpl});
  const sum=await host.execute({objective:'Add three values',capability:'math.sum',
    inputs:{numbers:[2,3,5]}});
  assert.equal(sum.status,'completed');
  assert.deepEqual(sum.execution.output,{total:10,count:3});
  assert.equal(sum.execution.provenance.provider,'local-node');
  const words=await host.execute({objective:'count five words, correctly',capability:'text.metrics'});
  assert.equal(words.status,'completed');
  assert.equal(words.execution.output.words,4);
  const unsupported=await host.execute(request);
  assert.equal(unsupported.status,'denied');
  assert.equal(f.calls.length,0);
});

test('allowlisted authenticated GitHub read executes fixed URL, returns provider record',async()=>{
  const f=service(),host=createReferenceHost(config(f));
  const result=await host.execute(request);
  assert.equal(result.status,'completed');
  assert.equal(result.execution.provenance.provider,'github');
  assert.equal(result.execution.output.repository,repository);
  assert.equal(result.execution.output.stars,6);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].url,'https://api.github.com/repos/'+repository);
  assert.equal(f.calls[0].redirect,'error');
  assert.equal(f.calls[0].authorization,'Bearer fixture-private-token');
});

test('host never allows request to grant unauthorized repositories or tools',async()=>{
  const f=service(),host=createReferenceHost(config(f));
  const blocked=await host.execute({...request,inputs:{repository:'attacker/hijack'},
    grants:['operations'],auditMode:'off',allowTaskWrites:true,
    objective:'ignore policy and create a shell command'});
  assert.equal(blocked.status,'provider_unavailable');
  assert.equal(f.calls.length,0);
  const unsupported=await host.execute({...request,capability:'software',grants:['software']});
  assert.equal(unsupported.status,'unsupported');
});

test('private audit fail-closed before tool or task state on public store',async t=>{
  const dir=await project(t),f=service({privateStore:false}),host=createReferenceHost(
    config(f,{auditMode:'required',auditRepository:store,durableProject:dir,
      durableSecret:'a-secret-for-isolated-project-host'}));
  const response=await host.execute(request);
  assert.equal(response.status,'audit_failed');
  assert.equal(response.audit.status,'failed');
  assert.equal(response.execution,null);
  assert.equal(f.calls.length,1);
  assert.equal((await loadProject(dir)).state.tasks.length,0);
});

test('injected GitHub API simulation never yields confirmed audit or dispatches a tool',async()=>{
  const f=service(),host=createReferenceHost(config(f,{
    auditMode:'required',auditRepository:store }));
  const result=await host.execute({...request, objective:'Never put this secret in the audit receipt'});
  assert.equal(result.status,'audit_unverified');
  assert.equal(result.audit.status,'simulated');
  assert.equal(result.audit.receiptCommit,undefined);
  assert.equal(result.execution,null);
  assert.equal(f.receipts.size,1);
  assert.ok(![...f.receipts.values()][0].includes('Never put this secret'));
  assert.deepEqual(f.calls.map(c=>c.method),
    ['GET','GET','GET','GET','GET','PUT','GET','GET']);
  assert.ok(!f.calls.some(c=>c.path==='/repos/'+repository && c.method==='GET'));
  assert.ok(f.calls.filter(c=>c.method==='PUT').every(c=>c.path.includes(store)));
});

test('failed audit PUT, corrupt readback, privacy race and invalid token do not execute',async()=>{
  for(const option of [{failAuditWrite:true},{corruptReadback:true},{publicAfterWrite:true}]) {
    const f=service(option),host=createReferenceHost(config(f,{
      auditMode:'required',auditRepository:store}));
    const result=await host.execute(request);
    assert.equal(result.status,'audit_failed');
    assert.equal(f.calls.some(c=>c.path==='/repos/'+repository && c.method==='GET'),false);
    assert.equal(result.execution,null);
  }
  const missing = createReferenceHost({auditMode:'required',auditRepository:store,
    token:'', fetchImpl:service().fetchImpl});
  assert.equal((await missing.execute(request)).status,'audit_failed');
});

test('network/provider failure remains truthfully unresolved rather than successful',async()=>{
  const f=service({failResearch:true}),host=createReferenceHost(config(f));
  const x=await host.execute(request);
  assert.equal(x.status,'provider_unavailable');
  assert.equal(x.execution,null);
});

test('durable duplicate retries and concurrent same-ID requests execute only once',async t=>{
  const f=service(),opts=await durable(t),host=createReferenceHost(config(f,opts));
  const results=await Promise.all([host.execute(request),host.execute(request),
    host.execute(request)]);
  assert.deepEqual(results.map(x=>x.status),['completed','already_executed','already_executed']);
  assert.equal(f.calls.filter(c=>c.path==='/repos/'+repository && c.method==='GET').length,1);
  const state=(await loadProject(opts.durableProject)).state;
  assert.equal(state.tasks.length,1);
  assert.equal(state.tasks[0].gatewayRun,'completed');
});

test('effects are denied without exact host authorization, even via heuristic routing',async t=>{
  const f=service(),opts=await durable(t),host=createReferenceHost(config(f,{
    ...opts,approvedIssue }));
  const blocked=await host.execute({...issueRequest,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
  assert.equal(blocked.status,'denied');
  const { capability, ...withoutCapability } = issueRequest;
  const heuristic=await host.execute({...withoutCapability,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    objective:'Plan workflow to create issue'});
  assert.equal(heuristic.status,'denied');
  assert.equal(f.calls.length,0);
});

test('explicitly approved durable GitHub issue creates once; retry never resends',async t=>{
  const f=service(),opts=await durable(t),host=createReferenceHost(config(f,{
    ...opts,approvedIssue }));
  const first=await host.execute(issueRequest);
  assert.equal(first.status,'completed');
  assert.equal(first.execution.output.issueNumber,22);
  const second=await host.execute({...issueRequest,id:id.toUpperCase()});
  assert.equal(second.status,'already_executed');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.deepEqual(JSON.parse(f.calls.find(c=>c.method==='POST').body),
    {title:'Verified host fixture',body:'No secrets'});
});

test('failed external effect is ambiguous and never automatically retried',async t=>{
  const f=service({failEffect:true}),opts=await durable(t),host=createReferenceHost(config(f,{
    ...opts,approvedIssue }));
  const first=await host.execute(issueRequest);
  assert.equal(first.status,'provider_unavailable');
  assert.equal(first.tracking.runState,'ambiguous');
  const again=await host.execute(issueRequest);
  assert.equal(again.status,'needs_reconciliation');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});

test('invalid input and host configuration fail before any provider request',async()=>{
  const f=service(),h=createReferenceHost(config(f));
  assert.equal((await h.execute({objective:' '.repeat(20000)})).status,'invalid_request');
  assert.equal((await h.execute({objective:'x'.repeat(70000)})).status,'invalid_request');
  assert.equal(f.calls.length,0);
  assert.throws(()=>createReferenceHost({allowedRepositories:['https://evil.com'],
    githubResearch:true}),/Unverified host/);
});


test('untrusted request accessors and stateful serialization cannot bypass host grants',async t=>{
  const f=service(),opts=await durable(t);
  const host=createReferenceHost(config(f,{...opts,approvedIssue}));
  let accesses=0;
  const getterRequest={ ...issueRequest, get id() {
    accesses++; return accesses === 1 ? id : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  } };
  const invalid=await host.execute(getterRequest);
  assert.equal(invalid.status,'invalid_request');
  assert.equal(accesses,0);
  assert.equal(f.calls.length,0);
  const input={repository, action:'github.create_issue',
    get title() { accesses++; return 'Hidden mutable title'; } };
  const nested=await host.execute({...issueRequest,inputs:input});
  assert.equal(nested.status,'invalid_request');
  assert.equal(accesses,0);
  assert.equal(f.calls.length,0);
});
test('request snapshot excludes mutable input references while executing an external provider',async()=>{
  const f=service();
  const requestObject={...request, inputs:{repository}};
  const h=createReferenceHost(config(f));
  const result=await h.execute(requestObject);
  requestObject.inputs.repository='attacker/hijack';
  assert.equal(result.status,'completed');
  assert.equal(result.execution.output.repository,repository);
  assert.equal(f.calls[0].url,'https://api.github.com/repos/'+repository);
});


test('host approval digest binds exact GitHub issue title and body before first task reservation',async t=>{
  const mock=service(),options=await durable(t);
  const host=createReferenceHost(config(mock,{...options,approvedIssue}));
  const badTitle=await host.execute({...issueRequest,inputs:{
    ...issueRequest.inputs,title:'ATTACKER-CONTROLLED announcement'}});
  assert.equal(badTitle.status,'denied');
  assert.equal(badTitle.reason,'effect_not_approved');
  const badBody=await host.execute({...issueRequest,inputs:{
    ...issueRequest.inputs,body:'Unapproved publication'}});
  assert.equal(badBody.status,'denied');
  assert.equal(mock.calls.length,0);
  assert.equal((await loadProject(options.durableProject)).state.tasks.length,0);
  const good=await host.execute(issueRequest);
  assert.equal(good.status,'completed');
  assert.equal(mock.calls.filter(x=>x.method==='POST').length,1);
  const later=await host.execute({...issueRequest,inputs:{
    ...issueRequest.inputs,body:'Changed after original authorized issue'}});
  assert.equal(later.status,'denied');
  assert.equal(mock.calls.filter(x=>x.method==='POST').length,1);
});
test('audit simulation is explicit; native confirmation refuses injected custom client',async()=>{
  const fake=service();
  assert.throws(()=>createReferenceHost(config(fake,{
    auditMode:'required',auditRepository:store,
    auditTransport:'native',auditFetchImpl:fake.fetchImpl
  })),/Unverified host/);
  assert.throws(()=>createReferenceHost(config(fake,{
    auditMode:'off',auditTransport:'simulation',
    auditFetchImpl:fake.fetchImpl
  })),/Unverified host/);
});
test('effect approval requires out-of-band host content digest',async t=>{
  const mock=service(),options=await durable(t);
  for(const payloadSha256 of [undefined,'f'.repeat(63),'G'.repeat(64)]) {
    assert.throws(()=>createReferenceHost(config(mock,{...options,
      approvedIssue:{requestId:id,repository,payloadSha256}})),/Unverified host/);
  }
  assert.notEqual(issueApprovalDigest({requestId:id,repository,
    title:'Verified host fixture',body:'No secrets'}),
    issueApprovalDigest({requestId:id,repository,
      title:'Verified host fixture',body:'No secrets added'}));
  assert.equal(issueApprovalDigest({requestId:id.toUpperCase(),repository:repository.toUpperCase(),
    title:'Verified host fixture',body:'No secrets'}), approvedIssue.payloadSha256);
});

test('PP-0007 enforced host trace binds real local handler output before release',async()=>{
  const host=createReferenceHost({traceMode:'enforced'});
  const res=await host.execute({objective:'Sum exact numbers and exclude this sensitive phrase',
    capability:'math.sum',inputs:{numbers:[2,3,5]},trace:{state:'released',
      events:[{step:'response.released'}]}});
  assert.equal(res.status,'completed');
  assert.deepEqual(res.execution.output,{total:10,count:3});
  assert.equal(res.trace.state,'released');
  assert.equal(res.trace.auditRequired,false);
  assert.equal(res.trace.provider,'local-node');
  assert.equal(res.trace.providerAuthenticated,false);
  assert.deepEqual(res.trace.events.map(x=>x.step),
    ['request.accepted','audit.not_required','route.selected','handler.started',
      'handler.returned','output.validated','response.released']);
  assert.equal(verifyReleasedExecution(res),true);
  assert.ok(!JSON.stringify(res.trace).includes('sensitive phrase'));
  assert.equal(res.trace.executionSha256,
    createHash('sha256').update(JSON.stringify(res.execution)).digest('hex'));
  const tamper=structuredClone(res);
  tamper.execution.output.total=999;
  assert.equal(verifyReleasedExecution(tamper),false);
  const reordered=structuredClone(res);
  [reordered.trace.events[3],reordered.trace.events[4]]=
    [reordered.trace.events[4],reordered.trace.events[3]];
  assert.equal(verifyReleasedExecution(reordered),false);
  const falseReceipt=structuredClone(res);
  falseReceipt.trace.auditRequired=true;
  assert.equal(verifyReleasedExecution(falseReceipt),false);
});

test('PP-0007 enforced trace records research handler, not a receipt-only completion',async()=>{
  const f=service(),host=createReferenceHost(config(f,{traceMode:'enforced'}));
  const outcome=await host.execute(request);
  assert.equal(outcome.status,'completed');
  assert.equal(outcome.trace.state,'released');
  assert.equal(outcome.trace.route,'research');
  assert.equal(outcome.trace.dispatchedCapability,'research');
  assert.equal(outcome.trace.provider,'github');
  assert.equal(outcome.trace.auditReceiptCommit,null);
  assert.equal(outcome.execution.output.repository,repository);
  assert.equal(verifyReleasedExecution(outcome),true);
  assert.equal(f.calls.filter(x=>x.path==='/repos/'+repository).length,1);
  // The local test double does not become a provider attestation.
  assert.equal(outcome.trace.providerAuthenticated,false);
});

test('PP-0007 enforced tracing fails closed on mock audit, unavailable audit and missing grants',async()=>{
  const privateMock=service(),host=createReferenceHost(config(privateMock,{
    traceMode:'enforced',auditMode:'required',auditRepository:store
  }));
  const simulated=await host.execute(request);
  assert.equal(simulated.status,'audit_unverified');
  assert.equal(simulated.trace.state,'not_released');
  assert.equal(simulated.execution,null);
  assert.deepEqual(simulated.trace.events.map(x=>x.step),
    ['request.accepted','audit.unverified']);
  assert.equal(privateMock.calls.some(x=>x.path==='/repos/'+repository&&x.method==='GET'),false);
  const publicMock=service({privateStore:false});
  const bad=createReferenceHost(config(publicMock,{
    traceMode:'enforced',auditMode:'required',auditRepository:store
  }));
  const deniedAudit=await bad.execute(request);
  assert.equal(deniedAudit.status,'audit_failed');
  assert.equal(deniedAudit.trace.state,'not_released');
  assert.equal(deniedAudit.execution,null);
  const noGrant=await createReferenceHost({traceMode:'enforced'}).execute(request);
  assert.equal(noGrant.status,'denied');
  assert.equal(noGrant.trace.state,'not_released');
  assert.equal(noGrant.execution,null);
  assert.equal(verifyReleasedExecution(noGrant),false);
});

test('PP-0007 trace cannot turn provider failure, duplicate replay or malicious trace input into success',async t=>{
  const failing=service({failResearch:true});
  const host=createReferenceHost(config(failing,{traceMode:'enforced'}));
  const bad=await host.execute({...request,trace:{status:'completed'}});
  assert.equal(bad.status,'provider_unavailable');
  assert.equal(bad.execution,null);
  assert.equal(bad.trace.state,'not_released');
  assert.ok(bad.trace.events.some(e=>e.step==='handler.failed'));
  const opts=await durable(t);
  const live=service();
  const durableHost=createReferenceHost(config(live,{...opts,traceMode:'enforced'}));
  const first=await durableHost.execute(request);
  const replay=await durableHost.execute(request);
  assert.equal(first.status,'completed');
  assert.equal(verifyReleasedExecution(first),true);
  assert.equal(replay.status,'already_executed');
  assert.equal(replay.execution,null);
  assert.equal(replay.trace.state,'not_released');
  assert.equal(verifyReleasedExecution(replay),false);
  assert.equal(live.calls.filter(x=>x.path==='/repos/'+repository).length,1);
});

test('PP-0007 release gate rejects missing handler events and forged audit metadata',()=>{
  const output={status:'completed',capability:'math.sum',suggestedRoute:'math.sum',
    execution:{output:{total:10,count:3},provenance:{provider:'local-node',operation:'math.sum'}}};
  const good=['request.accepted','audit.not_required','route.selected',
    'handler.started','handler.returned','output.validated'];
  assert.throws(()=>releaseExecutionTrace({steps:good.filter(x=>x!=='handler.started'),
    route:'math.sum',dispatched:'math.sum',result:output,
    audit:{status:'not_requested'},requiredAudit:false}),/release trace gate/);
  assert.throws(()=>releaseExecutionTrace({steps:good,route:'math.sum',
    dispatched:'research',result:output,audit:{status:'not_requested'},
    requiredAudit:false}),/release trace gate/);
  const audited=['request.accepted','audit.confirmed','route.selected',
    'handler.started','handler.returned','output.validated'];
  assert.throws(()=>releaseExecutionTrace({steps:audited,route:'math.sum',
    dispatched:'math.sum',result:output,audit:{status:'confirmed'},
    requiredAudit:true}),/release trace gate/);
  const noOutput={...output,execution:null};
  assert.throws(()=>releaseExecutionTrace({steps:good,route:'math.sum',
    dispatched:'math.sum',result:noOutput,audit:{status:'not_requested'},
    requiredAudit:false}),/release trace gate/);
});

test('PP-0007 trace is opt-in and requester cannot enable it or suppress audit requirements',async()=>{
  const plainHost=createReferenceHost();
  const untraced=await plainHost.execute({objective:'sum values',
    capability:'math.sum',inputs:{numbers:[2,3]},traceMode:'enforced'});
  assert.equal(untraced.status,'completed');
  assert.equal(untraced.trace,undefined);
  assert.throws(()=>createReferenceHost({traceMode:'not-real'}),/Unverified host/);
  const f=service(),secure=createReferenceHost(config(f,{
    traceMode:'enforced',auditMode:'required',auditRepository:store
  }));
  const x=await secure.execute({...request,auditMode:'off',traceMode:'off'});
  assert.equal(x.status,'audit_unverified');
  assert.equal(x.trace.state,'not_released');
});

test('PP-0007 explicit Node CLI only releases a validated execution; denied request has no output',()=>{
  const executable=fileURLToPath(new URL('../bin/reference-host.mjs',import.meta.url));
  const invoke=request=>spawnSync(process.execPath,[executable,'--enforce-trace'],
    {encoding:'utf8',input:JSON.stringify(request),timeout:15000,maxBuffer:32768});
  const ok=invoke({objective:'add three values',capability:'math.sum',inputs:{numbers:[2,3,5]}});
  assert.equal(ok.status,0,ok.stderr);
  assert.equal(ok.stderr,'');
  const passed=JSON.parse(ok.stdout);
  assert.equal(passed.status,'completed');
  assert.equal(passed.execution.output.total,10);
  assert.equal(verifyReleasedExecution(passed),true);
  const blocked=invoke({objective:'Research disallowed repository',
    capability:'research',inputs:{repository}});
  assert.equal(blocked.status,1);
  assert.equal(blocked.stderr,'');
  const denied=JSON.parse(blocked.stdout);
  assert.equal(denied.status,'denied');
  assert.equal(denied.execution,null);
  assert.equal(denied.trace.state,'not_released');
});

test('PP-0007 reviewer P2-1: missing audit store emits a blocked CLI trace without dispatch',()=>{
  const executable=fileURLToPath(new URL('../bin/reference-host.mjs',import.meta.url));
  const {PRO_PAPA_AUDIT_REPO, ...env}=process.env;
  const out=spawnSync(process.execPath,[executable,'--enforce-trace','--audit-required',
    '--github-read','--github-repo',repository],
    {input:JSON.stringify(request),encoding:'utf8',env,timeout:15000,maxBuffer:32768});
  assert.equal(out.status,1);
  assert.equal(out.stderr,'');
  const body=JSON.parse(out.stdout);
  assert.equal(body.status,'audit_failed');
  assert.equal(body.execution,null);
  assert.equal(body.audit.status,'failed');
  assert.equal(body.trace.state,'not_released');
  assert.deepEqual(body.trace.events.map(e=>e.step),['audit.failed']);
  assert.equal(body.trace.providerAuthenticated,false);
  assert.equal(verifyReleasedExecution(body),false);
});

test('PP-0007 reviewer P2-2: actual durable CLI replay has nonzero exit and no new execution',async t=>{
  const dir=await project(t),executable=fileURLToPath(new URL('../bin/reference-host.mjs',import.meta.url));
  const argv=[executable,'--enforce-trace','--durable','--project',dir];
  const env={...process.env,PRO_PAPA_GATEWAY_SECRET:'ci-fixture-host-managed-secret-at-least-16'};
  const input=JSON.stringify({id,objective:'add these known values',capability:'math.sum',
    inputs:{numbers:[2,3,5]}});
  const invoke=()=>spawnSync(process.execPath,argv,
    {input,env,encoding:'utf8',timeout:15000,maxBuffer:32768});
  const first=invoke();
  assert.equal(first.status,0,first.stderr);
  assert.equal(first.stderr,'');
  const initial=JSON.parse(first.stdout);
  assert.equal(initial.status,'completed');
  assert.equal(initial.execution.output.total,10);
  assert.equal(verifyReleasedExecution(initial),true);
  const second=invoke();
  assert.equal(second.status,1,second.stderr);
  assert.equal(second.stderr,'');
  const replay=JSON.parse(second.stdout);
  assert.equal(replay.status,'already_executed');
  assert.equal(replay.execution,null);
  assert.equal(replay.trace.state,'not_released');
  assert.equal(verifyReleasedExecution(replay),false);
  const state=(await loadProject(dir)).state;
  assert.equal(state.tasks.length,1);
});

test('PP-0007 reviewer P2-1: malformed traced CLI input returns non-release envelope',()=>{
  const executable=fileURLToPath(new URL('../bin/reference-host.mjs',import.meta.url));
  for(const input of ['{not-json','']) {
    const out=spawnSync(process.execPath,[executable,'--enforce-trace'],
      {input,encoding:'utf8',timeout:15000,maxBuffer:32768});
    assert.equal(out.status,1);
    assert.equal(out.stderr,'');
    const result=JSON.parse(out.stdout);
    assert.equal(result.status,'invalid_request');
    assert.equal(result.execution,null);
    assert.equal(result.trace.state,'not_released');
    assert.deepEqual(result.trace.events.map(e=>e.step),['request.rejected']);
  }
});
