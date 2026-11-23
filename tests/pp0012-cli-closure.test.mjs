// Evidence-based revision-99 successor created only by the original CLI in
// a source-pinned isolated GitHub Actions runner. No production claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateProject,selectNext} from '../src/core.mjs';
import {pp0012ClosureSnapshot,pp0012RegistrationSnapshot,pp0012ScopeSnapshot,pp0007LedgerSnapshot} from './pp0008-historical-pin-helper.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const sha256=b=>createHash('sha256').update(b).digest('hex');
const raw=read('.pro-papa/tasks.json'),candidate=JSON.parse(raw),before=pp0012ClosureSnapshot(candidate);
const work=candidate.tasks.find(x=>x.id==='PP-0012');
const priorWork=before.tasks.find(x=>x.id==='PP-0012');
const evidence=json('.pro-papa/evidence/PP-0012/isolated-cli-closure-candidate.json');
test('PP-0012 genuine protected-rev98 CLI closure produced exact isolated rev99 and no unrelated task changes',()=>{
 assert.equal(blob(raw),'eb1fbf445241161dae39c35681bca97bf8f9ed63');
 assert.equal(candidate.revision,99);
 assert.equal(before.revision,98);
 assert.equal(blob(Buffer.from(JSON.stringify(before,null,2)+'\n')),'efcc1755c99a52dabcd993c304d170d2a70c57f8');
 assert.equal(candidate.tasks.length,13);
 assert.equal(candidate.tasks.filter(t=>t.status==='verified').length,12);
 assert.equal(candidate.tasks.filter(t=>t.status==='in_progress').length,0);
 assert.equal(candidate.tasks.find(t=>t.id==='PP-0013').status,'pending');
 assert.equal(work.status,'verified');
 assert.equal(work.verifiedAt,'2026-11-23T14:50:04.588Z');
 assert.equal(priorWork.status,'in_progress');
 assert.equal(priorWork.verifiedAt,undefined);
 for(const t of candidate.tasks.filter(t=>t.id!=='PP-0012'))assert.deepEqual(t,before.tasks.find(x=>x.id===t.id));
 const changed=Object.keys(work).filter(k=>JSON.stringify(work[k])!==JSON.stringify(priorWork[k]));
 assert.deepEqual(changed,['status','verifiedAt']);
 assert.deepEqual(work.evidence,priorWork.evidence);
 assert.deepEqual(work.reviewTarget,priorWork.reviewTarget);
 assert.deepEqual(work.acceptance,priorWork.acceptance);
 assert.equal(validateProject(candidate,json('.pro-papa/profiles.json')),true);
 assert.equal(selectNext(candidate)?.id,'PP-0013');
 assert.equal(pp0012RegistrationSnapshot(candidate).revision,94);
 assert.equal(pp0012ScopeSnapshot(candidate).revision,93);
 assert.equal(pp0007LedgerSnapshot(candidate).canonicalBlob,'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
});
test('PP-0012 actual released GitHub Actions CLI closure and prior authenticated independent review are pinned',()=>{
 assert.equal(evidence.taskId,'PP-0012');
 assert.equal(evidence.status,'proposed_not_merged_or_deployed');
 assert.equal(evidence.source.protectedMainCommit,'9027ec0b826c34e0d7b7d32c91841e88d6b1445d');
 assert.equal(evidence.source.protectedLedgerBlob,'efcc1755c99a52dabcd993c304d170d2a70c57f8');
 assert.equal(evidence.source.isolatedRunnerCommit,'977ad4ffeafa48dcb3f0c985842d0ed8d53e16ad');
 assert.equal(evidence.source.isolatedWorkflowBlob,'3661a7c057aeada68dad4280f895522d18fc07b4');
 assert.equal(evidence.source.runId,45198411586);
 assert.equal(evidence.source.jobId,137774977860);
 assert.equal(evidence.source.result,'success');
 assert.equal(evidence.actual.command,'node bin/pro-papa.mjs close --id PP-0012 --root .');
 assert.equal(evidence.actual.ledgerGitBlob,blob(raw));
 assert.equal(evidence.actual.verifiedAt,work.verifiedAt);
 assert.equal(evidence.actual.taskStatus,'verified');
 assert.deepEqual(evidence.actual.onlyChangedTaskFields,['status','verifiedAt']);
 assert.equal(evidence.actual.evidenceUnchanged,true);
 assert.equal(evidence.actual.otherTasksUnchanged,true);
 const result=evidence.actual.closureResult;
 assert.deepEqual(result.required,['artifact','validation','review']);
 assert.deepEqual(result.verifiedFiles,work.evidence.map(x=>x.path));
 assert.equal(result.trustedReview.verdict,'PASS');
 assert.equal(result.trustedReview.reviewId,6009529716);
 assert.equal(result.trustedReview.candidateSha,'9efa40438443b73ee166b824233f1718b1b32af5');
 assert.equal(result.trustedReview.baseSha,'8fc9d709f4bd412a8ac40654185dac5c3bb28287');
 assert.ok(result.trustedReview.approvedReviewers.some(x=>x.login==='papa4568'));
 assert.equal(work.evidence.at(-1).actor,'papa4568');
 assert.notEqual(work.evidence.at(-1).actor,work.owner);
 for(const proof of work.evidence){
  assert.equal(proof.result,'pass');
  assert.equal(sha256(read(proof.path)),proof.sha256);
 }
 assert.equal(evidence.boundaries.protectedMainTaskStillInProgress,true);
 assert.equal(evidence.boundaries.independentReviewOfClosureCandidatePending,true);
 for(const key of ['mergeAuthorization','deploymentAuthorization','netlifyInvoked','productionChanges'])assert.equal(evidence.boundaries[key],false);
 assert.equal(evidence.scope.pp0013Changed,false);
 assert.equal(evidence.scope.generalOrStatisticalSuperiorityClaim,false);
});
test('PP-0012 closure pinned rev99 resists fabricated close, evidence mutation, review alteration, and security changes',()=>{
 const changes=[
  x=>{x.tasks.find(t=>t.id==='PP-0012').verifiedAt='2026-11-22T00:00:00.000Z';},
  x=>{x.tasks.find(t=>t.id==='PP-0012').status='in_progress';},
  x=>{x.tasks.find(t=>t.id==='PP-0012').evidence.pop();},
  x=>{x.tasks.find(t=>t.id==='PP-0012').reviewTarget.pullRequest=78;},
  x=>{x.tasks.find(t=>t.id==='PP-0012').requiresTrustedReview=false;},
  x=>{x.tasks.find(t=>t.id==='PP-0013').acceptance.pop();},
  x=>{x.tasks.find(t=>t.id==='PP-0011').verifiedAt='2020-01-01T00:00:00.000Z';},
 ];
 for(const mut of changes){
  const tampered=structuredClone(candidate);mut(tampered);
  assert.throws(()=>pp0012ClosureSnapshot(tampered),/Unknown PP-0012 closure candidate/);
  assert.throws(()=>pp0007LedgerSnapshot(tampered),/Unknown PP-0012 closure candidate/);
 }
 const unknown=structuredClone(candidate);unknown.revision=100;
 assert.throws(()=>pp0007LedgerSnapshot(unknown),/Unknown ledger mutation/);
});
