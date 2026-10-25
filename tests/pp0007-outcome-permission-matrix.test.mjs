import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const fixtureBytes=readFileSync(new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url));
const original=JSON.parse(fixtureBytes.toString('utf8'));
const matrix=JSON.parse(readFileSync(new URL('../fixtures/pp0007-outcome-permission-matrix.json',import.meta.url),'utf8'));
const expectedStatuses=new Map([['qa','unsupported'],['research','denied'],['software','unsupported'],['document','unsupported'],['data','completed'],['planning','denied'],['novel','unsupported']]);

test('gate 007-A stays pinned to the immutable original seven-case fixture and identities',()=>{
  const gitBlob=createHash('sha1').update('blob '+fixtureBytes.length+'\x00').update(fixtureBytes).digest('hex');
  assert.equal(gitBlob,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
  assert.equal(matrix.canonicalFixture.gitBlobSha,gitBlob);
  assert.equal(original.status,'not_collected');
  assert.equal(original.trials.length,7);
  assert.deepEqual(matrix.caseResults.map(x=>x.id),original.trials.map(x=>x.id));
  assert.deepEqual(matrix.caseResults.map(x=>x.id),[...expectedStatuses.keys()]);
  assert.equal(matrix.sourceMainCommit,'39076ac85a6864dd007b9ed6c947389548878508');
  for(const c of original.trials){
    assert.equal(c.baselineTrial,null,c.id);
    assert.equal(c.hostTrial,null,c.id);
    assert.equal(c.independentQualityAssessment,null,c.id);
    assert.equal(c.observedComparison,null,c.id);
    assert.ok(typeof c.canonicalObjective==='string' && c.canonicalObjective.length>0);
  }
});
test('gate 007-A never upgrades safe refusals or historical screenshot reports to canonical success',()=>{
  const s=matrix.caseResults.map(c=>c.nativeNoGrant.status);
  assert.deepEqual(s,[...expectedStatuses.values()]);
  assert.equal(matrix.caseResults.filter(c=>c.nativeNoGrant.requestedUserOutcomeCompleted).length,1);
  assert.equal(matrix.caseResults.filter(c=>c.nativeNoGrant.status==='denied').length,2);
  assert.equal(matrix.caseResults.filter(c=>c.nativeNoGrant.status==='unsupported').length,4);
  for(const c of matrix.caseResults){
    assert.equal(c.nativeNoGrant.actualGitHubReadAttempts,0,c.id);
    assert.equal(c.nativeNoGrant.requestedUserOutcomeCompleted,c.id==='data',c.id);
    assert.equal(c.nativeNoGrant.independentlyGradedTaskSuccess,null,c.id);
    assert.equal(c.nativeNoGrant.qualityGrade,null,c.id);
    assert.equal(c.retrospectiveDirectChatGPT.operatorReportedScreenshotSet,true,c.id);
    assert.equal(c.retrospectiveDirectChatGPT.originalTranscriptIndependentlyRead,false,c.id);
    assert.equal(c.retrospectiveDirectChatGPT.submittedPromptParityVerified,false,c.id);
    assert.equal(c.retrospectiveDirectChatGPT.requestedUserOutcomeCompleted,null,c.id);
    assert.equal(c.retrospectiveDirectChatGPT.qualityGrade,null,c.id);
    assert.equal(c.canonicalChatGPTProject.exactCaseOutputIndependentlyRead,false,c.id);
    assert.equal(c.canonicalChatGPTProject.requestedUserOutcomeCompleted,null,c.id);
    assert.equal(c.canonicalChatGPTProject.qualityGrade,null,c.id);
    for(const field of ['correctionInteractions','elapsedMilliseconds','providerReportedTokens']){
      assert.equal(c.retrospectiveDirectChatGPT[field],null,c.id+field);
      assert.equal(c.canonicalChatGPTProject[field],null,c.id+field);
    }
  }
});
test('gate 007-A disallows pooling historically different trial arms and fabricated cost',()=>{
  assert.equal(matrix.referenceHostNoGrant.actualCompletedHandlerCases,1);
  assert.equal(matrix.referenceHostNoGrant.providerGitHubWrites,0);
  assert.equal(matrix.referenceHostNoGrant.perPilotAuditReceipt,false);
  assert.equal(matrix.referenceHostWithResearchGrant.completedRequestedOutcomes,2);
  assert.equal(matrix.referenceHostWithResearchGrant.totalCases,7);
  assert.equal(matrix.referenceHostWithResearchGrant.readGrant,true);
  assert.equal(matrix.referenceHostWithResearchGrant.realGitHubGETsInstrumented,1);
  assert.equal(matrix.referenceHostWithResearchGrant.networkPacketLevelConfirmation,null);
  assert.equal(matrix.separatelyGrantedNativeResearch.permissionParityWithTextOnlyApi,false);
  assert.equal(matrix.supplementaryStructuredHost.mechanicallyValidated,4);
  assert.equal(matrix.supplementaryStructuredHost.total,4);
  assert.equal(matrix.supplementaryStructuredHost.safeRefusals,5);
  assert.equal(matrix.historicalRetrospectiveWebsiteReport.missingRegularSoftwareZip,true);
  assert.equal(matrix.historicalRetrospectiveWebsiteReport.recoveredForThisGate,0);
  assert.equal(matrix.prospectiveUiV2.observationsCompleted,0);
  assert.equal(matrix.prospectiveUiV2.observationsPlanned,42);
  assert.equal(matrix.comparisonFields.permissionParity,false);
  assert.equal(matrix.comparisonFields.taskCloseoutReady,false);
  for(const field of ['directAssistantMatchedOutcomeQuality','matchedCorrectionCount','comparableLatencyMilliseconds','comparableToolCalls','comparableProviderTokens'])
    assert.equal(matrix.comparisonFields[field],null,field);
});
