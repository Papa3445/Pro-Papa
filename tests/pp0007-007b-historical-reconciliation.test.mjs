import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const originalBytes=readFileSync(new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url));
const original=JSON.parse(originalBytes.toString('utf8'));
const report=JSON.parse(readFileSync(new URL('../fixtures/pp0007-007b-historical-reconciliation.json',import.meta.url),'utf8'));
const ids=['qa','research','software','document','data','planning','novel'];
const scoreR=[4,3,2,3,4,3,2],scoreP=[4,3,3,3,4,3,3];
const timeR=[null,26,183,null,null,null,null],timeP=[38,52,280,52,49,126,71];

test('007-B stays on original frozen prompts and preserves all null trial slots',()=>{
 const sha=createHash('sha1').update('blob '+originalBytes.length+'\x00').update(originalBytes).digest('hex');
 assert.equal(sha,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
 assert.equal(report.canonicalFixture.gitBlobSha,sha);
 assert.equal(original.status,'not_collected');
 assert.deepEqual(original.trials.map(x=>x.id),ids);
 assert.deepEqual(report.cases.map(x=>x.id),ids);
 for(const trial of original.trials){
   assert.equal(trial.baselineTrial,null);
   assert.equal(trial.hostTrial,null);
   assert.equal(trial.independentQualityAssessment,null);
   assert.equal(trial.observedComparison,null);
 }
});

test('007-B reconciles post hoc 0–4 review without converting it into official or independently verified grades',()=>{
 assert.deepEqual(report.cases.map(x=>x.regular.reportedProvisionalInterimScoreOutOf4),scoreR);
 assert.deepEqual(report.cases.map(x=>x.project.reportedProvisionalInterimScoreOutOf4),scoreP);
 assert.equal(scoreR.reduce((a,b)=>a+b,0),report.archivedSecondaryReviewerRubric.regularTotalReported);
 assert.equal(scoreP.reduce((a,b)=>a+b,0),report.archivedSecondaryReviewerRubric.projectTotalReported);
 assert.equal(report.archivedSecondaryReviewerRubric.maximumPerArm,28);
 assert.equal(report.archivedSecondaryReviewerRubric.notOfficialFrameworkGrade,true);
 assert.equal(report.archivedSecondaryReviewerRubric.qualitySuperiorityProven,false);
 assert.deepEqual([report.separateEarlierRetrospectiveScores.regularScoreReported,report.separateEarlierRetrospectiveScores.projectScoreReported],[18,21]);
 assert.equal(report.separateEarlierRetrospectiveScores.maximumPerArm,21);
 assert.equal(report.separateEarlierRetrospectiveScores.doNotAddToInterimReviewerScores,true);
 for(const rec of report.cases){
  assert.equal(rec.archiveEvidenceKind,'private_secondary_summary_reports_only');
  assert.equal(rec.originalPromptParityIndependentlyConfirmed,false);
  assert.equal(rec.reviewedUnderIdenticalIndependentAcceptanceTests,false);
  for(const arm of [rec.regular,rec.project]){
   assert.equal(arm.fullResponseRecovered,false);
   assert.equal(arm.sourceArtifactRecovered,false);
   assert.equal(arm.taskCompletionIndependentlyVerified,null);
   assert.equal(arm.permissionsVerified,false);
   assert.equal(arm.correctionInteractions,null);
   assert.equal(arm.providerTokens,null);
  }
 }
 assert.equal(report.recovery.originalScreenshotBytesRecoveredInThisIncrement,0);
 assert.equal(report.recovery.privateLibrarySecondaryReportsRead,2);
});

test('007-B treats UI time labels, owner acceptance and prospective data as distinct and unknown-safe',()=>{
 assert.deepEqual(report.cases.map(x=>x.regular.uiWorkedForSecondsReported),timeR);
 assert.deepEqual(report.cases.map(x=>x.project.uiWorkedForSecondsReported),timeP);
 assert.deepEqual(report.measuredBoundaries.pairedUiLabelsPresentForCases,['research','software']);
 assert.equal(report.measuredBoundaries.matchedOutputQualityVerifiedCaseCount,0);
 assert.equal(report.measuredBoundaries.matchedComparablePermissionCaseCount,0);
 for(const name of ['providerReportedTokenTotals','totalHumanCorrections','comparableWallClockTaskDurationMs','qualityAdjustedEfficiency','causalEffectEstimate','estimatedCostSavings'])
  assert.equal(report.measuredBoundaries[name],null,name);
 assert.equal(report.ownerDecision.kind,'product_owner_practical_usability_acceptance');
 assert.equal(report.ownerDecision.authorizedToContinue,true);
 assert.equal(report.ownerDecision.independentTechnicalApprovalForPP0007,false);
 assert.equal(report.ownerDecision.changesOriginalAcceptance,false);
 assert.equal(report.decision.canClosePP0007,false);
 assert.equal(report.decision.canUseAsProspectiveTrialResults,false);
 assert.equal(report.separateStudies.prospectiveUiV2Completed,0);
 assert.equal(report.separateStudies.prospectiveUiV2Planned,42);
});
