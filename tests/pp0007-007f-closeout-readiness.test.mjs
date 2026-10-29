import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pp0007LedgerSnapshot} from './pp0008-historical-pin-helper.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const m=read('fixtures/pp0007-007f-closeout-readiness.json');
const taskLedger=read('.pro-papa/tasks.json');
const original=read('fixtures/pp0007-paired-trial-collection-template.json');
const v2=read('fixtures/pp0007-ui-v2-contract.json');
const proposal=read('fixtures/pp0007-route-b-acceptance-proposal.json');
const application=read('fixtures/pp0007-route-b-application-authorization.json');
const exactApplicationLedger='a28a48789714c1051482b7c3201aac4e9a8c0a69';
const evidenceLedger='7bf9061e1463521d045183010b29f1d890b02a4a';
const finalCloseoutLedger='c5bdf86ff43c6b6dcfe54563d187d86218ae3571';
const exactCriteria=[
'Run reproducible end-to-end requests across at least six representative categories: quick Q&A, sourced research, software, document creation, calculation/data analysis, and planning or operations, including a novel/fallback request',
'For each pilot distinguish executed tools, persisted task/evidence where relevant, real audit receipts and substantive output validation; include deliberate negative cases for unauthorized operations, unavailable tools and inaccurate receipts',
'Report outcome quality, task completion rate, corrective interactions, latency/tool-call or token overhead where measurable, and limitations compared with a simple direct-assistant baseline',
'Publish reproducible test fixtures and results, pass exact-head CI, and obtain genuine independent review before task closure or assertions of readiness'
];
test('007-F reuses unchanged source task ledger, acceptance and original seven-case fixture',()=>{
 assert.equal(m.decision,'blocked_keep_in_progress');
 assert.equal(m.scopeAtSourceCommit,undefined);
 assert.equal(m.sourceMainCommit,'39076ac85a6864dd007b9ed6c947389548878508');
 assert.equal(m.sourceTaskLedgerRevision,72);
 const ledgerSha=(()=>{
  const bytes=readFileSync(new URL('.pro-papa/tasks.json',root));
  return createHash('sha1').update('blob '+bytes.length+'\x00').update(bytes).digest('hex');
 })();
 const successor=[77,78,79,80,84,85].includes(taskLedger.revision)?pp0007LedgerSnapshot(taskLedger).isSuccessor:false;
 const compat=m.exactLedgerCompatibility;
 assert.deepEqual(compat.addedFutureTaskIds,['PP-0008','PP-0009','PP-0010','PP-0011']);
 assert.ok([compat.historicalMainBlob,compat.separateApprovedProposedBlob,exactApplicationLedger,evidenceLedger,finalCloseoutLedger].includes(ledgerSha)||successor,
   'only exact original or separately approved roadmap-preview ledger bytes may be used');
 const isFinal=ledgerSha===finalCloseoutLedger||successor;
 const isEvidence=isFinal||ledgerSha===evidenceLedger;
 const isApplied=isEvidence||ledgerSha===exactApplicationLedger;
 const isPreview=isApplied||ledgerSha===compat.separateApprovedProposedBlob;
 assert.equal(application.candidateLedgerGitBlobSha,exactApplicationLedger);
 assert.equal(taskLedger.revision,successor?taskLedger.revision:isFinal?76:isEvidence?75:isApplied?74:isPreview?compat.separateApprovedProposedRevision:m.sourceTaskLedgerRevision);
 assert.equal(taskLedger.tasks.length,isFinal?13:isApplied?12:isPreview?compat.separateApprovedProposedTaskCount:m.sourceTaskCount);
 if(isPreview){
   assert.deepEqual(taskLedger.tasks.slice(7,11).map(x=>x.id),compat.addedFutureTaskIds);
   for(const x of taskLedger.tasks.slice(7,11)){
     assert.equal(x.status,successor&&x.id==='PP-0008'?
      (taskLedger.revision>=79?'verified':'in_progress'):
      successor&&x.id==='PP-0009'&&taskLedger.revision>=80?(taskLedger.revision===85?'verified':'in_progress'):'pending');
     assert.deepEqual(x.dependsOn,['PP-0007']);
   }
 }
 assert.equal(m.pinSources.length,5);
 for(const pin of m.pinSources){
  const bytes=readFileSync(new URL(pin.path,root));
  const sha=createHash('sha1').update('blob '+bytes.length+'\x00').update(bytes).digest('hex');
  if(pin.path==='.pro-papa/tasks.json'){
   assert.equal(pin.gitBlobSha,m.exactLedgerCompatibility.historicalMainBlob);
   assert.ok([pin.gitBlobSha,m.exactLedgerCompatibility.separateApprovedProposedBlob,exactApplicationLedger,evidenceLedger,finalCloseoutLedger].includes(sha)||successor);
  }else if(pin.path==='AGENTS.md'){
   // The historical pin refers to the original AGENTS blob at m.sourceMainCommit.
   // Preserve that exact original prefix; an independently reviewed delivery
   // policy addendum must not rewrite the old source fixture or its hash.
   const marker=Buffer.from('\n## Development throughput and loop prevention\n');
   const pos=bytes.indexOf(marker);
   if(pos===-1)assert.equal(sha,pin.gitBlobSha,pin.path);
   else {
    assert.equal(bytes.lastIndexOf(marker),pos,'no duplicate agent policy section');
    const historical=bytes.subarray(0,pos);
    const historicalSha=createHash('sha1').update('blob '+historical.length+String.fromCharCode(0)).update(historical).digest('hex');
    assert.equal(historicalSha,pin.gitBlobSha,'historical AGENTS content prefix must remain exact');
    assert.ok(bytes.subarray(pos).toString('utf8').includes('docs/DEVELOPMENT-DELIVERY.md'));
   }
  }else assert.equal(sha,pin.gitBlobSha,pin.path);
 }
 const task=taskLedger.tasks.find(x=>x.id==='PP-0007');
 assert.equal(task.status,isFinal?'verified':'in_progress');
 assert.deepEqual(proposal.taskBefore.acceptance,exactCriteria);
 assert.deepEqual(task.acceptance,isApplied?proposal.proposedTaskAfter.acceptance:exactCriteria);
 if(isApplied){
  const successor=taskLedger.tasks.find(x=>x.id==='PP-0012');
  assert.equal(successor.status,'pending');
  assert.deepEqual(successor.acceptance.slice(0,4),exactCriteria);
  assert.deepEqual(successor.acceptance.slice(4),proposal.deferredOriginalObligations.proposalForDistinctFutureTask.candidateAcceptance);
 }
 assert.equal(m.acceptanceCount,task.acceptance.length);
 assert.deepEqual(m.acceptance.map(x=>x.criterion),[1,2,3,4]);
 assert.equal(original.status,'not_collected');
 assert.equal(original.trials.length,7);
 assert.ok(original.trials.every(x=>x.baselineTrial===null&&x.hostTrial===null&&x.independentQualityAssessment===null));
 assert.equal(v2.status,'predeclared_not_executed');
 // 007-F is a frozen historical blocked-readiness decision, not an updated
 // milestone verdict. New current review pins must not rewrite its source record.
 const historicalTarget=isEvidence?proposal.source.originalReviewTarget:task.reviewTarget;
 assert.deepEqual(m.currentReviewTarget,{...historicalTarget,isCurrentCloseoutTarget:false});
 if(isEvidence){
  assert.deepEqual(task.reviewTarget,isFinal?{repository:'Papa3445/Pro-Papa',pullRequest:53,
    baseRef:'main',baseSha:'6fa479f20e1c94643ebf0b7ceaa4509caaacf189'}:
    {repository:'Papa3445/Pro-Papa',pullRequest:52,baseRef:'main',
    baseSha:'837283019ba062933ec2775c27f405f8bcace8e4'});
  assert.equal(task.evidence.length,isFinal?85:83);
  if(isFinal){
   assert.ok(Number.isFinite(Date.parse(task.verifiedAt)));
   const deferred=taskLedger.tasks.find(x=>x.id==='PP-0013');
   assert.equal(deferred.status,'pending');
   assert.deepEqual(deferred.dependsOn,['PP-0007']);
  }
 }
});
test('007-F fails task-success promotion despite scoped approved CI/reviews',()=>{
 assert.deepEqual(m.acceptance.map(x=>x.verdict),['not_met','partial','partial','partial']);
 assert.equal(m.acceptance[0].observation.ungrantedHostCompletions,1);
 assert.equal(m.acceptance[0].observation.grantedHostCompletions,2);
 assert.equal(m.acceptance[0].observation.structuredLocalDifferentInputsCompletions,4);
 assert.equal(m.acceptance[0].observation.prospectiveUiObservationsCollected,0);
 assert.equal(m.acceptance[1].observation.realNegativeLiveHttpChecks,5);
 assert.equal(m.acceptance[1].observation.perCanonicalPilotPrivateReceipts,null);
 for(const name of ['matchedDirectAssistantOutputQualityGrade','humanCorrectionTurns','providerReportedTokens','matchedTotalLatency','causalSuperiorityEstimate'])
  assert.equal(m.acceptance[2].observation[name],null,name);
 assert.equal(m.acceptance[3].observation.newCloseoutCurrentHeadIndependentApproval,false);
 assert.equal(m.acceptance[3].observation.pp0007FormalReviewTargetCurrentPr,false);
 const rs=m.reviewAndIntegration;
 assert.equal(rs.individuallyApprovedScopedPrs.length,7);
 assert.deepEqual(rs.individuallyApprovedScopedPrs.map(x=>x.number),[32,33,34,35,38,39,40]);
 assert.ok(rs.individuallyApprovedScopedPrs.every(x=>x.scopedApprovalObserved===true&&x.approvalForFinalMilestone===false));
 assert.equal(rs.combinedTestsPassed,270);
 assert.equal(rs.combinedTestsFailed,0);
 assert.equal(rs.combinedTaskCount,11);
 assert.equal(rs.wasMergedToMain,false);
 assert.equal(rs.wasDeployed,false);
 assert.equal(rs.doesNotCountAsMilestoneApproval,true);
});
test('007-F disallows implied owner scope rewrite, GitHub protection and deployment assertion',()=>{
 assert.equal(m.provenanceBoundaries.ownerPracticalAcceptance,true);
 assert.equal(m.provenanceBoundaries.ownerAuthorizedRewriteOfCurrentAcceptance,false);
 assert.equal(m.provenanceBoundaries.prospectivePairObservationsActuallyCollected,0);
 assert.equal(m.provenanceBoundaries.prospectivePairObservationsPlanned,42);
 assert.equal(m.provenanceBoundaries.selfReviewCannotCountAsIndependentApproval,true);
 assert.equal(m.provenanceBoundaries.approvalDoesNotTransferFromChildPrs,true);
 assert.equal(m.provenanceBoundaries.noNewProviderOrModelTrialPerformed,true);
 assert.deepEqual(m.decisionPaths.map(x=>x.id),['original_contract_completion','explicit_owner_scope_change']);
 assert.equal(m.decisionPaths[1].ownerActionRequired,true);
 const release=m.releaseBlockers.find(x=>x.id==='native_github_required_review_and_ci_rules');
 assert.equal(release.protected,false);
 assert.equal(release.status,'not_enforced');
 assert.equal(m.releaseBlockers.find(x=>x.id==='candidate_netlify_exact_deployed_sha_and_postdeploy_smoke').status,'unverified');
 assert.equal(m.unsafeActionsProhibited.markPp0007Verified,true);
 assert.equal(m.unsafeActionsProhibited.repinToThisPrAsFinalCloseout,true);
 assert.equal(m.unsafeActionsProhibited.declareStatisticalPerformanceSuperiority,true);
});
