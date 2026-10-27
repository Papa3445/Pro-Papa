import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const parse=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const overhead=parse('fixtures/pp0007-007d-overhead-correction-accounting.json');
const seven=parse('.pro-papa/evidence/PP-0007/live-read-only-github.json');
const structured=parse('.pro-papa/evidence/PP-0007/structured-local-observation.json');
const canonical=parse('fixtures/pp0007-paired-trial-collection-template.json');
const ids=['qa','research','software','document','data','planning','novel'];
test('007-D pins immutable existing sources and reproduces genuine host-side calls',()=>{
 assert.equal(overhead.sourceMainCommit,'39076ac85a6864dd007b9ed6c947389548878508');
 assert.equal(overhead.sourceIdentities.length,4);
 for(const ref of overhead.sourceIdentities){
  const bytes=readFileSync(new URL(ref.path,root));
  const blob=createHash('sha1').update('blob '+bytes.length+'\x00').update(bytes).digest('hex');
  assert.equal(blob,ref.gitBlobSha,ref.path);
 }
 assert.deepEqual(seven.pilots.map(x=>x.id),ids);
 assert.deepEqual(overhead.hostGrantedSeven.perCase.map(x=>x.id),ids);
 assert.equal(seven.mode,'live_read_only_github');
 assert.equal(seven.totalGitHubCallsObserved,overhead.hostGrantedSeven.realGithubCallsObserved);
 assert.equal(seven.totalResearchTransportCallsObserved,overhead.hostGrantedSeven.githubTransportCallsObserved);
 assert.equal(seven.successfulUserTasks,overhead.hostGrantedSeven.completedUserRequestsInNarrowConfiguredHost);
 for(const [i,x] of seven.pilots.entries()){
  const own=overhead.hostGrantedSeven.perCase[i];
  assert.deepEqual([own.status,own.hostElapsedMs,own.providerGithubCalls,own.transportCalls],
   [x.status,x.elapsedMs,x.providerCalls,x.transportCalls],x.id);
  assert.equal(x.correctionInteractionsObserved,overhead.hostGrantedSeven.scriptedCorrectionInteractionFieldsPerCase[i]);
 }
 assert.equal(seven.meanHostTimeMs,overhead.hostGrantedSeven.meanHostElapsedMsReported);
 assert.equal(seven.medianHostTimeMs,overhead.hostGrantedSeven.medianHostElapsedMsReported);
 assert.equal(seven.durableProbe.elapsedMs,overhead.hostGrantedSeven.temporaryDurableProjectProbe.elapsedMs);
 assert.equal(seven.correctionalInteractionsMeasured,undefined); // reject invented key
 assert.equal(seven.correctiveInteractionsMeasured,false);
 assert.equal(overhead.hostGrantedSeven.userCorrectionsActuallyMeasured,false);
 assert.equal(overhead.hostGrantedSeven.actualHumanCorrectiveInteractions,null);
 assert.equal(seven.receiptCount,0);
 assert.equal(overhead.hostGrantedSeven.perPilotPrivateReceiptsIssued,0);
 assert.equal(canonical.status,'not_collected');
});
test('007-D keeps four separate structured operations and zero script prompts distinct from human rework',()=>{
 const x=structured.observedReport;
 assert.equal(x.pilotCount,4);assert.equal(x.mechanicallyValidatedCompletions,4);
 assert.equal(x.hostCalls,9);assert.equal(x.negativeCount,5);
 assert.equal(x.totalHostElapsedMs,overhead.separateStructuredFour.totalHostElapsedMsReported);
 assert.equal(x.meanHostElapsedMs,overhead.separateStructuredFour.meanHostElapsedMsReported);
 assert.equal(x.receiptCount,overhead.separateStructuredFour.receiptCount);
 assert.equal(x.externalToolCallsObserved,overhead.separateStructuredFour.externalToolCalls);
 assert.equal(x.realGitHubCallsObserved,overhead.separateStructuredFour.realGitHubCalls);
 assert.deepEqual(overhead.separateStructuredFour.perCase,x.pilots.map(y=>({id:y.id,hostElapsedMs:y.elapsedMs})));
 assert.equal(x.actualHumanCorrections,null);
 assert.equal(overhead.separateStructuredFour.actualHumanCorrections,null);
 assert.equal(overhead.separateStructuredFour.representativeOriginalSeven,false);
 assert.equal(overhead.hostUngrantSeven.localHandlerCompletions,1);
 assert.equal(overhead.hostUngrantSeven.grantChanged,true);
 assert.equal(overhead.hostUngrantSeven.caseIds.length,7);
 assert.equal(overhead.hostUngrantSeven.hostElapsedMsReported.length,7);
});
test('007-D retains secondary UI labels without fabricated paired wall clocks, costs or correction counts',()=>{
 const ui=overhead.historicalUi;
 assert.equal(ui.sourceNotOriginals,true);assert.equal(ui.originalScreenshotsReadThisGate,false);
 assert.deepEqual(ui.caseLabels.map(x=>x.id),ids);
 const paired=ui.caseLabels.filter(x=>x.regularWorkedForSecondsReported!==null&&x.projectWorkedForSecondsReported!==null);
 assert.deepEqual(paired.map(x=>x.id),['research','software']);
 assert.deepEqual(paired.map(x=>[x.regularWorkedForSecondsReported,x.projectWorkedForSecondsReported]),[[26,52],[183,280]]);
 assert.equal(ui.caseLabels.every(x=>x.matchedClockBoundaryVerified===false&&x.matchedModelAndPermissionsVerified===false&&x.humanCorrectionTurnsVerified===null),true);
 for(const key of ['llmProviderTokenTotals','llmInputTokens','llmOutputTokens','netlifyMeasuredWallClockLatencyMs','chatgptTotalTimePerCaseMs','externalProviderBilledCostUsd','userCorrectionMinutes','taskQualityNormalizedEffort','comparativeLatencyRatio','perEndToEndInvocationActualToolTracesAcrossSeven'])
  assert.equal(overhead.observabilityAndCost[key],null,key);
 for(const key of ['regularUiCorrectionTurns','projectUiCorrectionTurns','modelRetries','providerErrorRetries','manualReworkMinutes','totalHumanCorrections'])
  assert.equal(overhead.correctionAccounting[key],null,key);
 assert.equal(overhead.correctionAccounting.nodeReporterCorrectionInteractionsObservedZeroIsNotUserCorrectionsZero,true);
 assert.equal(overhead.observabilityAndCost.prospectiveUiV2ObservedCount,0);
 assert.equal(overhead.observabilityAndCost.prospectiveUiV2PlannedCount,42);
 assert.equal(overhead.ownerDecision.independentPerformanceSuperiorityProven,false);
 assert.equal(overhead.safetyBoundary.doNotPoolDistinctStudies,true);
 assert.equal(overhead.safetyBoundary.pp0007TaskClosed,false);
 const related=new URL('fixtures/pp0007-007b-historical-reconciliation.json',root);
 if(existsSync(related)){
  const source=parse('fixtures/pp0007-007b-historical-reconciliation.json');
  assert.equal(source.cases.length,7);
  for(const [i,c] of source.cases.entries()){
   const label=ui.caseLabels[i];
   assert.equal(label.id,c.id);
   assert.equal(label.regularWorkedForSecondsReported,c.regular.uiWorkedForSecondsReported);
   assert.equal(label.projectWorkedForSecondsReported,c.project.uiWorkedForSecondsReported);
  }
 }
});
