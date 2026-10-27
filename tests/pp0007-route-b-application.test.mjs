import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const at=new URL('../',import.meta.url);
const read=x=>JSON.parse(readFileSync(new URL(x,at),'utf8'));
const blob=x=>{const b=readFileSync(new URL(x,at));return createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');};
const ledger=read('.pro-papa/tasks.json'),proposal=read('fixtures/pp0007-route-b-acceptance-proposal.json'),app=read('fixtures/pp0007-route-b-application-authorization.json');
const active=ledger.tasks.find(x=>x.id==='PP-0007'),successor=ledger.tasks.find(x=>x.id==='PP-0012');
const evidenceLedgerSha='7bf9061e1463521d045183010b29f1d890b02a4a';
const finalCloseoutLedgerSha='c5bdf86ff43c6b6dcfe54563d187d86218ae3571';
const productionEvidence='.pro-papa/evidence/PP-0007/production-auth0-signed-jwt-2026-10-27.json';
const productionEvidenceSha256='5e30604377b37f8f7bccc341562eae497031b368e9869746735e7369528a58b7';
const hashSha256=x=>createHash('sha256').update(readFileSync(new URL(x,at))).digest('hex');
const hashBlobText=x=>{const b=Buffer.from(x);return createHash('sha1').update('blob '+b.length+String.fromCharCode(0)).update(b).digest('hex');};
test('Route B candidate ledger applies exact approved wording and preserves all historical evidence bytes',()=>{
 // Preserve the original reviewed Route B rev74 bytes by reconstructing the
 // previous ledger from the evidence-only rev75 transition, not rewriting its fixture.
 assert.equal(blob('.pro-papa/tasks.json'),finalCloseoutLedgerSha);
 assert.equal(ledger.revision,76);assert.equal(ledger.tasks.length,13);
 // Reconstruct exact trusted prior rev75 to prove this is append-only closure.
 const previous=structuredClone(ledger);
 previous.revision=75;
 previous.tasks=previous.tasks.filter(x=>x.id!=='PP-0013');
 const previousActive=previous.tasks.find(x=>x.id==='PP-0007');
 previousActive.evidence=previousActive.evidence.slice(0,83);
 previousActive.status='in_progress';delete previousActive.verifiedAt;
 previousActive.reviewTarget={repository:'Papa3445/Pro-Papa',pullRequest:52,
   baseRef:'main',baseSha:'837283019ba062933ec2775c27f405f8bcace8e4'};
 assert.equal(hashBlobText(JSON.stringify(previous,null,2)+String.fromCharCode(10)),evidenceLedgerSha);
 const old=structuredClone(previous);old.revision=74;
 const oldActive=old.tasks.find(x=>x.id==='PP-0007');
 oldActive.evidence=oldActive.evidence.slice(0,82);
 oldActive.reviewTarget=proposal.source.originalReviewTarget;
 assert.equal(hashBlobText(JSON.stringify(old,null,2)+String.fromCharCode(10)),app.candidateLedgerGitBlobSha);
 assert.equal(app.reviewedProposalHead,'c2d06b2ccd5e127d42236e93dbf3c6a8817dd0a8');
 assert.equal(blob('fixtures/pp0007-route-b-acceptance-proposal.json'),app.reviewedProposalGitBlobSha);
 assert.equal(active.status,'verified'); assert.equal(active.owner,'chatgpt-implementation');
 assert.ok(Number.isFinite(Date.parse(active.verifiedAt)));
 assert.deepEqual(active.dependsOn,['PP-0006']);
 assert.equal(active.evidence.length,85);
 const evidenceText=JSON.stringify(active.evidence.slice(0,82)),evidenceBytes=Buffer.from(evidenceText);
 const evidenceDigest=createHash('sha1').update('blob '+evidenceBytes.length+'\x00').update(evidenceBytes).digest('hex');
 assert.equal(evidenceDigest,app.originalEvidenceArrayGitBlobSha);
 assert.deepEqual(active.reviewTarget,{repository:'Papa3445/Pro-Papa',pullRequest:53,
   baseRef:'main',baseSha:'6fa479f20e1c94643ebf0b7ceaa4509caaacf189'});
 const last=active.evidence[82];
 assert.equal(last.kind,'test');assert.equal(last.result,'pass');
 const validation=active.evidence[83],review=active.evidence[84];
 assert.equal(validation.kind,'validation');assert.equal(validation.result,'pass');
 assert.equal(review.kind,'review');assert.equal(review.result,'pass');
 assert.equal(review.actor,'papa4568');
 assert.equal(hashSha256(validation.path),validation.sha256);
 assert.equal(hashSha256(review.path),review.sha256);
 assert.equal(read(review.path).finalReviewGate.pullRequest,53);
 assert.equal(read(review.path).finalReviewGate.requiresActualIndependentCurrentHeadApproval,true);
 assert.equal(last.path,productionEvidence);
 assert.equal(last.sha256,productionEvidenceSha256);
 assert.equal(hashSha256(productionEvidence),productionEvidenceSha256);
 const observed=read(productionEvidence);
 assert.equal(observed.manualAuthorizedRun.runId,40553891521);
 assert.deepEqual(observed.manualAuthorizedRun.observedChecks,[
   'pinned_auth0_token_issued','authorized_math_sum_released','tampered_signature_denied']);
 // Source-pinned historical production run used the prior published main,
 // not the new milestone PR's review base commit.
 assert.equal(observed.manualAuthorizedRun.headSha,'837283019ba062933ec2775c27f405f8bcace8e4');
 assert.equal(observed.production.commitRef,observed.manualAuthorizedRun.headSha);
 assert.equal(observed.explicitLimitations.originalSevenCaseBenchmarkCollected,false);
 assert.equal(observed.explicitLimitations.productionRollbackExecuted,false);
 assert.equal(active.title,proposal.proposedTaskAfter.title);
 assert.equal(active.objective,proposal.proposedTaskAfter.objective);
 assert.deepEqual(active.acceptance,proposal.proposedTaskAfter.acceptance);
});
test('Route B successor preserves original full benchmark and cannot start',()=>{
 assert.equal(successor.status,'pending');assert.equal(successor.profile,'general');
 assert.equal(successor.owner,null); assert.equal(successor.blockedReason,null);
 assert.deepEqual(successor.evidence,[]);
 assert.deepEqual(successor.dependsOn,['PP-0007','PP-0011']);
 assert.equal(successor.objective,proposal.taskBefore.objective);
 assert.deepEqual(successor.acceptance.slice(0,4),proposal.taskBefore.acceptance);
 assert.deepEqual(successor.acceptance.slice(4),proposal.deferredOriginalObligations.proposalForDistinctFutureTask.candidateAcceptance);
 assert.equal(ledger.tasks.filter(x=>x.status==='in_progress').length,0);
 const deferred=ledger.tasks.find(x=>x.id==='PP-0013');
 assert.equal(deferred.status,'pending');assert.equal(deferred.profile,'software');
 assert.deepEqual(deferred.dependsOn,['PP-0007']);
 assert.equal(deferred.evidence.length,0);
 assert.deepEqual(ledger.tasks.slice(7,11).map(x=>x.id),['PP-0008','PP-0009','PP-0010','PP-0011']);
 assert.ok(ledger.tasks.slice(7,11).every(x=>x.status==='pending'&&JSON.stringify(x.dependsOn)==='["PP-0007"]'));
});
test('Route B candidate original trial, historical blocked verdict and approval boundaries unchanged',()=>{
 const frozen=read('fixtures/pp0007-paired-trial-collection-template.json'),ui=read('fixtures/pp0007-ui-v2-contract.json');
 assert.equal(blob('fixtures/pp0007-paired-trial-collection-template.json'),'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
 assert.equal(blob('fixtures/pp0007-ui-v2-contract.json'),'610ad35c145944b0f41ceb8f4f07a363046d3272');
 assert.equal(frozen.status,'not_collected');assert.equal(frozen.trials.length,7);
 assert.ok(frozen.trials.every(x=>x.baselineTrial===null&&x.hostTrial===null));
 assert.equal(ui.status,'predeclared_not_executed');
 assert.equal(read('fixtures/pp0007-007f-closeout-readiness.json').decision,'blocked_keep_in_progress');
 for(const k of ['mergeAuthorized','deployAuthorized','closePP0007Authorized','startDependentsAuthorized','newIndependentApplicationReviewReceived','actualMainChangedByThisBranch'])assert.equal(app.limits[k],false,k);
 assert.equal(app.onlyReviewProposedCandidate,true);
});
