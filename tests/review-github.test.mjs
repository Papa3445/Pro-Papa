import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateGitHubReviews as evalReviews, validateReviewTarget, verifyGitHubReview } from '../src/review-github.mjs';
import { initializeProject, loadProject, addTask, startTask, recordEvidence, closeTask, validateProject } from '../src/core.mjs';

const target={repository:'Papa3445/Pro-Papa',pullRequest:2}, sha='a'.repeat(40);
const pull={number:2,base:{repo:{full_name:'Papa3445/Pro-Papa'},ref:'main',sha:'b'.repeat(40)},head:{sha},user:{id:124238718,login:'Papa3445'}};
let counter=1;
function review(state='APPROVED',changes={}) {
  const id=counter++;
  return {id,state,commit_id:sha,submitted_at:new Date(Date.UTC(2026,0,1,0,id)).toISOString(),user:{id:196889071,login:'papa4568'},...changes};
}
function mock(reviews=[],current=pull){
  const calls=[];
  return {calls, fetchImpl:async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,json:async()=>url.endsWith('/pulls/2')?current:reviews};
  }};
}
test('fixed review target rejects URL, injection, unknown fields and wrong type',()=>{
  assert.deepEqual(validateReviewTarget(target),target);
  for(const v of [{...target,repository:'https://evil.test/'},{...target,pullRequest:'2'},{...target,command:'rm -rf /'},null]){
    assert.throws(()=>validateReviewTarget(v),/review requires/);
  }
});
test('real separate GitHub identity and current SHA approve',()=>{
  const x=evalReviews(target,pull,[review()]);
  assert.equal(x.verdict,'PASS');assert.equal(x.candidateSha,sha);assert.equal(x.reviewer.id,196889071);
});
test('old SHA and PR author approval are rejected',()=>{
  assert.equal(evalReviews(target,pull,[review('APPROVED',{commit_id:'b'.repeat(40)})]).verdict,'FAIL');
  assert.equal(evalReviews(target,pull,[review('APPROVED',{user:pull.user})]).verdict,'FAIL');
});
test('failed review blocks until same reviewer approves current head',()=>{
  const a=review(),b=review('CHANGES_REQUESTED');
  assert.equal(evalReviews(target,pull,[a,b]).verdict,'FAIL');
  assert.equal(evalReviews(target,pull,[a,b,review()]).verdict,'PASS');
});
test('other reviewer cannot override outstanding changes',()=>{
  assert.equal(evalReviews(target,pull,[review('CHANGES_REQUESTED'),review('APPROVED',{user:{id:91,login:'other'}})]).verdict,'FAIL');
});
test('commented or dismissed review record does not count as an approval',()=>{
  assert.equal(evalReviews(target,pull,[review('COMMENTED')]).verdict,'FAIL');
  const approval=review('APPROVED');
  assert.equal(evalReviews(target,pull,[{...approval,state:'DISMISSED'}]).verdict,'FAIL');
});
test('wrong repository, PR number and bad SHA reject provider identity',()=>{
  assert.throws(()=>evalReviews(target,{...pull,number:3},[review()]),/identity/);
  assert.throws(()=>evalReviews(target,{...pull,base:{repo:{full_name:'wrong/repo'}}},[review()]),/identity/);
  assert.throws(()=>evalReviews(target,{...pull,head:{sha:'short'}},[review()]),/identity/);
});
test('read-only authenticated GitHub API, no arbitrary hosts',async()=>{
  const f=mock([review()]);
  await assert.rejects(verifyGitHubReview(target,{token:'',fetchImpl:f.fetchImpl}),/GITHUB_TOKEN/);
  assert.equal((await verifyGitHubReview(target,{token:'testing',fetchImpl:f.fetchImpl})).verdict,'PASS');
  assert.equal(f.calls.length,5);
  for(const {url,options} of f.calls){
    assert.ok(url.startsWith('https://api.github.com/repos/Papa3445/Pro-Papa/pulls/2'));
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer testing');
  }
});
test('API errors and incomplete reviews fail closed',async()=>{
  await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl:async()=>({ok:false,status:403})}),/HTTP 403/);
  await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl:async()=>({ok:true,json:async()=>null})}),/Malformed/);
  const hundred=Array.from({length:100},()=>review('COMMENTED'));
  await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl:async(url)=>({ok:true,json:async()=>url.endsWith('/pulls/2')?pull:hundred})}),/Too many/);
});
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'pp-review-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await initializeProject(root,'Trusted reviews');
  const {state,profiles}=await loadProject(root);
  const task=addTask(state,profiles,{title:'Critical',objective:'Trusted verification',profile:'general',acceptance:['Audited']});
  task.requiresTrustedReview=true;task.reviewTarget={...target};
  startTask(state,task.id,'implementer');
  for(const kind of ['artifact','validation','review']){
    const file=join(root,kind+'.txt');await writeFile(file,kind+' evidence');
    await recordEvidence(root,state,{id:task.id,kind,file,actor:kind==='review'?'papa4568':'implementer',note:'observed'});
  }
  validateProject(state,profiles);
  return {root,state,profiles,task};
}
test('manual review cannot close without current real approval',async t=>{
  const {root,state,profiles,task}=await fixture(t);
  await assert.rejects(closeTask(root,state,profiles,task.id,{token:'x',fetchImpl:mock([]).fetchImpl}),/trusted review rejected/);
  await assert.rejects(closeTask(root,state,profiles,task.id,{token:'x',fetchImpl:mock([review('APPROVED',{commit_id:'b'.repeat(40)})]).fetchImpl}),/trusted review rejected/);
  assert.equal(task.status,'in_progress');
});
test('recorded reviewer actor must match provider identity',async t=>{
  const {root,state,profiles,task}=await fixture(t);
  await assert.rejects(closeTask(root,state,profiles,task.id,{token:'x',fetchImpl:mock([review('APPROVED',{user:{id:987,login:'stranger'}})]).fetchImpl}),/identity differs/);
});
test('trusted approval enables closure, with provider-candidate details',async t=>{
  const {root,state,profiles,task}=await fixture(t);
  const x=await closeTask(root,state,profiles,task.id,{token:'x',fetchImpl:mock([review()]).fetchImpl});
  assert.equal(x.trustedReview.verdict,'PASS');assert.equal(x.trustedReview.candidateSha,sha);
  assert.equal(task.status,'verified');
});
test('historical tasks remain valid without new review requirements',async t=>{
  const {root,state,profiles,task}=await fixture(t);
  delete task.reviewTarget;delete task.requiresTrustedReview;
  await closeTask(root,state,profiles,task.id);
  validateProject(state,profiles);assert.equal(task.status,'verified');
});

test('old-head changes requested stays blocking after newer reviewer approval',()=>{
  const prior=review('CHANGES_REQUESTED',{commit_id:'b'.repeat(40)});
  const other=review('APPROVED',{user:{id:91,login:'other'}});
  const blocked=evalReviews(target,pull,[prior,other]);
  assert.equal(blocked.verdict,'FAIL');assert.deepEqual(blocked.blockingReviewIds,[prior.id]);
  assert.equal(evalReviews(target,pull,[prior,other,review('APPROVED',{commit_id:'b'.repeat(40)})]).verdict,'FAIL');
  assert.equal(evalReviews(target,pull,[prior,other,review('APPROVED')]).verdict,'PASS');
});
test('formal dismissal updates the SAME review ID and cannot itself approve',()=>{
  const prior=review('CHANGES_REQUESTED',{commit_id:'b'.repeat(40)});
  const other=review('APPROVED',{user:{id:91,login:'other'}});
  const dismissed={...prior,state:'DISMISSED'}; // PUT /reviews/{prior.id}/dismissals updates this record.
  assert.equal(dismissed.id,prior.id);
  assert.equal(evalReviews(target,pull,[prior,other]).verdict,'FAIL');
  assert.equal(evalReviews(target,pull,[dismissed]).verdict,'FAIL');
  assert.equal(evalReviews(target,pull,[dismissed,other]).verdict,'PASS');
});
test('dismissal of a DIFFERENT review ID cannot clear a still-requested change',()=>{
  const prior=review('CHANGES_REQUESTED',{commit_id:'b'.repeat(40)});
  const other=review('APPROVED',{user:{id:91,login:'other'}});
  const dismissed=review('DISMISSED',{commit_id:'b'.repeat(40)}); // separate ID, same reviewer
  assert.notEqual(prior.id,dismissed.id);
  const blocked=evalReviews(target,pull,[prior,other,dismissed]);
  assert.equal(blocked.verdict,'FAIL');
  assert.deepEqual(blocked.blockingReviewIds,[prior.id]);
  const sameReviewerApproval=review('APPROVED');
  assert.equal(evalReviews(target,pull,[prior,other,dismissed,sameReviewerApproval]).verdict,'PASS');
});
test('dismissal removes only the specific approval review, not approvals by others',()=>{
  const first=review('APPROVED');
  const other=review('APPROVED',{user:{id:91,login:'other'}});
  const dismissed={...first,state:'DISMISSED'};
  assert.equal(evalReviews(target,pull,[dismissed]).verdict,'FAIL');
  assert.equal(evalReviews(target,pull,[dismissed,other]).verdict,'PASS');
});
test('duplicate review ID with conflicting states fails closed',()=>{
  const request=review('CHANGES_REQUESTED');
  assert.throws(()=>evalReviews(target,pull,[request,{...request,state:'DISMISSED'}]),/IDs missing or duplicated/);
});
test('changed PR head while paginating reviews fails closed',async()=>{
  let reads=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>{
    if(url.endsWith('/pulls/2'))return ++reads===1?pull:{...pull,head:{sha:'b'.repeat(40)}};
    return [review()];
  }});
  await assert.rejects(verifyGitHubReview(target,{token:'test',fetchImpl}),/changed during review lookup/);
  assert.equal(reads,2);
});
test('stable PR head recheck still passes',async()=>{
  const x=await verifyGitHubReview(target,{token:'test',fetchImpl:mock([review()]).fetchImpl});
  assert.equal(x.verdict,'PASS');assert.equal(x.candidateSha,sha);
});
test('changed PR author identity while paginating reviews fails closed',async()=>{
  let reads=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>{
    if(url.endsWith('/pulls/2'))return ++reads===1?pull:{...pull,user:{id:555,login:'new-author'}};
    return [review()];
  }});
  await assert.rejects(verifyGitHubReview(target,{token:'test',fetchImpl}),/changed during review lookup/);
});

test('review history changes during lookup fail closed without PR head change',async()=>{
  const approver=review('APPROVED',{user:{id:51,login:'reviewer51'}});
  const blocker=review('CHANGES_REQUESTED',{user:{id:52,login:'reviewer52'}});
  let reads=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>url.endsWith('/pulls/2')?pull:++reads===1?[approver]:[approver,blocker]});
  await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl}),/reviews changed during review lookup/);
  assert.equal(reads,2);
});
test('review state update or dismissal during lookup fails closed',async()=>{
  const prior=review('APPROVED');let reads=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>url.endsWith('/pulls/2')?pull:++reads===1?[prior]:[{...prior,state:'DISMISSED'}]});
  await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl}),/reviews changed during review lookup/);
});
test('new change request on second page cannot bypass snapshot comparison',async()=>{
  const first=review('APPROVED');
  const filler=Array.from({length:99},()=>review('COMMENTED'));
  const blocker=review('CHANGES_REQUESTED',{user:{id:987,login:'blocker'}});
  let round=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>{
    if(url.endsWith('/pulls/2'))return pull;
    const page=new URL(url).searchParams.get('page');
    if(page==='1'){round++;return [first,...filler];}
    return round===1?[]:[blocker];
  }});
  await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl}),/reviews changed during review lookup/);
});
test('A-B-A approvals select latest submission rather than Map insertion',()=>{
  const a={id:111,login:'reviewerA'},b={id:222,login:'reviewerB'};
  const first=review('APPROVED',{user:a});
  const middle=review('APPROVED',{user:b});
  const last=review('APPROVED',{user:a});
  const x=evalReviews(target,pull,[first,middle,last]);
  assert.equal(x.verdict,'PASS');assert.equal(x.reviewId,last.id);
  assert.equal(x.reviewer.login,'reviewerA');
  assert.deepEqual(x.approvedReviewers.map(v=>v.login),['reviewerB','reviewerA']);
});
test('task closure accepts any matching GitHub approver on exact head',async t=>{
  const {root,state,profiles,task}=await fixture(t);
  const a=review('APPROVED',{user:{id:196889071,login:'papa4568'}});
  const b=review('APPROVED',{user:{id:444,login:'reviewerB'}});
  const report=await closeTask(root,state,profiles,task.id,{token:'x',fetchImpl:mock([a,b]).fetchImpl});
  assert.equal(report.trustedReview.reviewer.login,'reviewerB');
  assert.equal(task.status,'verified');
});

test('malformed unresolved changes requests fail closed before reviewer filtering',()=>{
  const approved=review('APPROVED');
  const blocked=review('CHANGES_REQUESTED',{commit_id:'b'.repeat(40)});
  const invalid=[
    {...blocked,user:null},
    {...blocked,user:{id:0,login:'missing'}},
    {...blocked,user:{id:555,login:''}},
    {...blocked,submitted_at:null},
    {...blocked,submitted_at:'not-a-date'},
    {...blocked,commit_id:null},
  ];
  for (const bad of invalid) {
    assert.throws(()=>evalReviews(target,pull,[approved,bad]),/Malformed decisive GitHub review/);
  }
});
test('stable double snapshot cannot hide a malformed change request',async()=>{
  const approved=review('APPROVED');
  const blocked=review('CHANGES_REQUESTED',{commit_id:'b'.repeat(40)});
  for(const bad of [{...blocked,user:null},{...blocked,submitted_at:null},{...blocked,user:{id:12,login:''}}]){
    const api=mock([approved,bad]);
    await assert.rejects(verifyGitHubReview(target,{token:'x',fetchImpl:api.fetchImpl}),/Malformed decisive GitHub review/);
    assert.equal(api.calls.length,5);
  }
});
test('invalid approval is not ignored to pass using another reviewer',()=>{
  const approved=review('APPROVED');
  const invalid=review('APPROVED',{user:null});
  assert.throws(()=>evalReviews(target,pull,[approved,invalid]),/Malformed decisive GitHub review/);
  assert.equal(evalReviews(target,pull,[approved,review('COMMENTED',{user:null})]).verdict,'PASS');
  assert.equal(evalReviews(target,pull,[approved,review('DISMISSED',{user:null})]).verdict,'PASS');
});


test('base branch retarget between initial and middle reads fails closed',async()=>{
  let reads=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>{
    if(url.endsWith('/pulls/2'))return ++reads===1?pull:{...pull,base:{...pull.base,ref:'release'}};
    return [review()];
  }});
  await assert.rejects(verifyGitHubReview(target,{token:'test',fetchImpl}),/changed during review lookup/);
  assert.equal(reads,2);
});
test('base SHA advances during later PR read but head remains stable',async()=>{
  let reads=0;
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>{
    if(url.endsWith('/pulls/2'))return ++reads<3?pull:{...pull,base:{...pull.base,sha:'c'.repeat(40)}};
    return [review()];
  }});
  await assert.rejects(verifyGitHubReview(target,{token:'test',fetchImpl}),/changed during review lookup/);
  assert.equal(reads,3);
});
test('pinned base ref and SHA reject stable retarget or advancement',async()=>{
  const pinned={...target,baseRef:'main',baseSha:'b'.repeat(40)};
  assert.equal((await verifyGitHubReview(pinned,{token:'test',fetchImpl:mock([review()]).fetchImpl})).verdict,'PASS');
  for (const other of [
    {...pull,base:{...pull.base,ref:'release'}},
    {...pull,base:{...pull.base,sha:'c'.repeat(40)}},
  ]) {
    const result=await verifyGitHubReview(pinned,{token:'test',fetchImpl:mock([review()],other).fetchImpl});
    assert.equal(result.verdict,'FAIL');
    assert.match(result.reason,/pinned review target/);
  }
});
test('base and review state must have valid identity',()=>{
  const approved=review();
  assert.throws(()=>evalReviews(target,{...pull,base:{...pull.base,ref:''}},[approved]),/identity/);
  assert.throws(()=>evalReviews(target,{...pull,base:{...pull.base,sha:'short'}},[approved]),/identity/);
  assert.throws(()=>evalReviews(target,pull,[approved,review('CHANGES_REQUESTED ')]),/Unknown GitHub review state/);
  assert.throws(()=>validateReviewTarget({...target,baseRef:'main'}),/exact GitHub repository/);
  assert.throws(()=>validateReviewTarget({...target,baseSha:'b'.repeat(40)}),/exact GitHub repository/);
});

test('PP-0007 no-key ChatGPT PR cannot reuse approved PR #17',async()=>{
  const task=JSON.parse(await readFile(new URL('../.pro-papa/tasks.json',import.meta.url),'utf8')).tasks.find(x=>x.id==='PP-0007');
  assert.equal(task.status,'in_progress');
  assert.equal(task.requiresTrustedReview,true);
  assert.deepEqual(task.reviewTarget,{repository:'Papa3445/Pro-Papa',pullRequest:18,baseRef:'main',baseSha:'a6acacd6344be05bc8f9caffbd3f18abaf9a276d'});
  const p={number:18,base:{repo:{full_name:'Papa3445/Pro-Papa'},ref:'main',sha:'a6acacd6344be05bc8f9caffbd3f18abaf9a276d'},
    head:{sha:'c'.repeat(40)},user:{id:124238718,login:'Papa3445'}};
  const prior=review('APPROVED',{commit_id:'d'.repeat(40)});
  assert.throws(()=>evalReviews(task.reviewTarget,{...p,number:17},[prior]),/identity/);
  assert.equal(evalReviews(task.reviewTarget,p,[prior]).verdict,'FAIL');
  assert.equal(evalReviews(task.reviewTarget,p,[review('APPROVED',{commit_id:p.head.sha})]).verdict,'PASS');
  assert.ok(task.evidence.some(e=>e.path==='bin/pp0007-manual-chatgpt-baseline.mjs'));
});
