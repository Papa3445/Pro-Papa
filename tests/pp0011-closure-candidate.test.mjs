// PP-0011: exact branch-only closure proposal matching a real token-backed CLI run.
// Keep original rev92 and historic PP-0007 through PP-0010 byte identities intact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateProject,selectNext} from '../src/core.mjs';
import {pp0011ClosureSnapshot,pp0011RegistrationSnapshot,pp0007LedgerSnapshot,pp0012ScopeSnapshot} from './pp0008-historical-pin-helper.mjs';

const root=new URL('../',import.meta.url);
const read=x=>readFileSync(new URL(x,root));
const raw=Buffer.from(JSON.stringify(pp0012ScopeSnapshot(JSON.parse(read('.pro-papa/tasks.json'))),null,2)+'\n');
const state=JSON.parse(raw);
const before=pp0011ClosureSnapshot(state);
const report=JSON.parse(read('.pro-papa/evidence/PP-0011/scoped-closure-candidate-2026-11-15.json'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const work=state.tasks.find(x=>x.id==='PP-0011');
const previous=before.tasks.find(x=>x.id==='PP-0011');

test('PP-0011 proposal is exact rev93 single-task transition with genuine preserved rev92',()=>{
 assert.equal(blob(raw),'9b1e4dba9d37fc0b440d23d5ae46c1ccaab95eff');
 assert.equal(state.revision,93);
 assert.equal(before.revision,92);
 assert.equal(blob(Buffer.from(JSON.stringify(before,null,2)+'\n')),'37a35059c4a426ae7f0d23997bae40b961df08aa');
 assert.equal(work.status,'verified');
 assert.equal(work.verifiedAt,'2026-11-17T02:35:12.473Z');
 assert.equal(previous.status,'in_progress');
 assert.equal(previous.verifiedAt,undefined);
 assert.equal(state.tasks.length,13);
 assert.equal(state.tasks.filter(x=>x.status==='verified').length,11);
 assert.equal(state.tasks.filter(x=>x.status==='in_progress').length,0);
 assert.deepEqual(work.evidence,previous.evidence);
 assert.deepEqual(work.acceptance,previous.acceptance);
 assert.deepEqual(work.reviewTarget,previous.reviewTarget);
 assert.deepEqual(work.reviewTarget,{repository:'Papa3445/Pro-Papa',pullRequest:74,
   baseRef:'main',baseSha:'5d84f80cb36509fa20d50f87551461bba2804a79'});
 assert.ok(state.tasks.filter(x=>x.id!=='PP-0011').every(x=>
   JSON.stringify(x)===JSON.stringify(before.tasks.find(y=>y.id===x.id))));
 assert.equal(state.tasks.find(x=>x.id==='PP-0012').status,'pending');
 assert.equal(state.tasks.find(x=>x.id==='PP-0013').status,'pending');
 assert.equal(selectNext(state)?.id,'PP-0012');
 assert.equal(validateProject(state,JSON.parse(read('.pro-papa/profiles.json'))),true);
});

test('PP-0011 recorded evidence remains actual source-hash matched, not proof by assertion',()=>{
 const files=[
  ['artifact','.pro-papa/evidence/PP-0011/host-domain-outcomes-2026-11-15.json','976ce48cadacf074298815a308573c907ace7d899d4390a3d649c3fb5eca850f'],
  ['validation','.pro-papa/evidence/PP-0011/host-validation-2026-11-15.json','aed66357cce6b6d86c064fd95a14d41f445a6451b6cb0a34bda907f800fd36c8'],
  ['review','.pro-papa/evidence/PP-0011/independent-scope-reviews-2026-11-15.json','05356d4d64edcea051127d8986b303f45b7d86be5a1e81f41b7693f3944d24f9']
 ];
 assert.deepEqual(work.evidence.map(p=>[p.kind,p.path,p.sha256]),files);
 assert.deepEqual(report.registeredEvidence.map(p=>[p.kind,p.path,p.sha256]),files);
 for(const [kind,path,digest] of files){
  assert.equal(sha256(read(path)),digest,path);
  const proof=JSON.parse(read(path));
  assert.equal(proof.taskId,'PP-0011');
  assert.equal(proof.evidenceKind,kind);
  assert.equal(proof.result,'pass');
 }
 assert.equal(work.owner,'chatgpt-implementation');
 assert.equal(work.evidence.at(-1).actor,'papa4568');
 assert.notEqual(work.evidence.at(-1).actor,work.owner);
 assert.equal(report.independentGitHubSource.priorEvidenceIntakePR,74);
 assert.equal(report.independentGitHubSource.priorApprovedReviewId,5913367526);
 assert.equal(report.independentGitHubSource.closureCandidateIndependentReview,'prior_changes_requested_new_head_review_pending');
});

test('PP-0011 proposed closure preserves historical approved pins and excludes inflated claims',()=>{
 assert.equal(pp0011RegistrationSnapshot(state).revision,91);
 assert.equal(pp0007LedgerSnapshot(state).canonicalBlob,'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
 assert.equal(state.tasks.find(x=>x.id==='PP-0007').evidence.length,85);
 assert.deepEqual(report.base,{repository:'Papa3445/Pro-Papa',
   protectedMain:'baad35b96a8f48768a6b5682d2c9b145a69e7e43',
   revision:92,taskStatus:'in_progress',
   taskLedgerGitBlob:'37a35059c4a426ae7f0d23997bae40b961df08aa'});
 assert.equal(report.candidate.revision,93);
 assert.equal(report.candidate.taskLedgerGitBlob,'9b1e4dba9d37fc0b440d23d5ae46c1ccaab95eff');
 assert.equal(report.candidate.merged,false);
 assert.equal(report.executionTruth.genuineLocalCliCloseRun,false);
 assert.equal(report.executionTruth.genuineLiveTokenBackedCliCloseRun,true);
 assert.equal(report.cliProof.status,'completed');
 assert.equal(report.cliProof.runId,44004065672);
 assert.equal(report.cliProof.runHead,'b11d0e2e24e0968f73b2c8338585e364000a25b9');
 assert.equal(report.cliProof.reviewId,5913367526);
 assert.equal(report.cliProof.verifiedAt,'2026-11-17T02:35:12.473Z');
 assert.equal(report.cliProof.ledgerGitBlob,'9b1e4dba9d37fc0b440d23d5ae46c1ccaab95eff');
 assert.equal(report.cliProof.providerBacked,true);
 assert.equal(report.cliProof.noProductionChanges,true);
 assert.equal(report.operatorAcceptance.fourRealHostSamples.blobSha,'0d7705be8260faaf353dfa4ee4220b583a6c518f');
 assert.equal(report.operatorAcceptance.publicIssuePreview.blobSha,'51a9a6a54d574172b8d6347926cd2edb54b71b3c');
 assert.equal(report.permissions.netlifyInvoked,false);
 assert.equal(report.permissions.deployAuthorized,false);
 assert.equal(report.permissions.mainChangedByThisCandidate,false);
 assert.ok(report.excludedClaims.some(s=>s.includes('research')));
 assert.ok(report.excludedClaims.some(s=>s.includes('rollout')));
 assert.ok(!JSON.stringify(report).includes('private artifact contents'));
});

test('PP-0011 closure snapshot rejects unreviewed task, time, review or proof mutation',()=>{
 for(const change of [
  x=>{x.revision=94;},
  x=>{x.tasks.find(t=>t.id==='PP-0011').verifiedAt='2020-01-01T00:00:00.000Z';},
  x=>{x.tasks.find(t=>t.id==='PP-0011').status='in_progress';},
  x=>{x.tasks.find(t=>t.id==='PP-0011').evidence[0].sha256='0'.repeat(64);},
  x=>{x.tasks.find(t=>t.id==='PP-0011').reviewTarget.pullRequest=75;},
  x=>{x.tasks.find(t=>t.id==='PP-0012').status='in_progress';},
  x=>{x.tasks.find(t=>t.id==='PP-0010').verifiedAt='2020-01-01T00:00:00.000Z';},
  x=>{x.tasks.find(t=>t.id==='PP-0007').evidence.pop();},
 ]){
  const candidate=structuredClone(state);change(candidate);
  if(candidate.revision===94)assert.throws(()=>pp0007LedgerSnapshot(candidate),/Unknown ledger mutation/);
  else {
   assert.throws(()=>pp0011ClosureSnapshot(candidate),/Unknown PP-0011 closure candidate/);
   assert.throws(()=>pp0007LedgerSnapshot(candidate),/Unknown PP-0011 closure candidate/);
  }
 }
});
