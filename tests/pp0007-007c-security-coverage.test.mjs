import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('../fixtures/pp0007-007c-security-coverage.json',import.meta.url),'utf8'));
const expectedIds=['metadata-200','get-mcp-405','no-bearer-tools-call-denied',
  'invalid-bearer-tools-call-denied','cross-origin-403'];

test('007-C pins each applicable live-probe/OAuth source blob to audited main',()=>{
  assert.equal(manifest.sourceMainCommit,'39076ac85a6864dd007b9ed6c947389548878508');
  assert.equal(manifest.sourceCodePins.length,10);
  assert.equal(manifest.reviewedCandidateSourceCompatibility.productionDeployedAndVerified,false);
  assert.equal(manifest.reviewedCandidateSourceCompatibility.independentReviewOfCandidateCompleted,false);
  assert.equal(new Set(manifest.sourceCodePins.map(p=>p.path)).size,10);
  for(const pin of manifest.sourceCodePins){
    assert.equal(pin.sourceRef,manifest.sourceMainCommit,pin.path);
    assert.match(pin.path,/^(?:src|tests|bin|netlify\/functions|\.github\/workflows)\/[A-Za-z0-9._/-]+$/);
    const content=readFileSync(new URL('../'+pin.path,import.meta.url));
    const blob=createHash('sha1').update('blob '+content.length+'\x00').update(content).digest('hex');
    if(pin.path==='netlify/functions/mcp.mjs'&&
       blob!==pin.gitBlobSha){
      const candidate=manifest.reviewedCandidateSourceCompatibility;
      assert.equal(pin.gitBlobSha,candidate.historicalNetlifySourceGitBlobSha);
      assert.equal(blob,candidate.candidateRemediationNetlifySourceGitBlobSha,
        'only the exact scoped independently reviewable runtime fix may supersede historical entrypoint bytes');
      const regression=readFileSync(new URL('../tests/pp0007-netlify-warm-lifecycle.test.mjs',import.meta.url),'utf8');
      assert.match(regression,/PP-0007 Netlify warm validator reuses JWKS/);
      assert.match(regression,/capacity counts concurrent authenticated research to eight/);
    }else assert.equal(blob,pin.gitBlobSha,pin.path);
  }
});
test('007-C maintains only five live production HTTP checks and no authenticated JWT or host-noninvocation claim',()=>{
  const prod=manifest.reviewedProductionLiveProbe;
  assert.deepEqual(prod.checks.map(x=>x.id),expectedIds);
  assert.equal(prod.workflowConclusion,'success');
  assert.equal(prod.sourcePrHead,manifest.providerTestProof.approvedAtExactHead);
  assert.equal(prod.jobId,121080934380);
  assert.equal(prod.credentialFree,true);
  assert.equal(prod.realNetworkResponsesObserved,true);
  assert.equal(prod.noValidAuthenticationCredentialSupplied,true);
  assert.equal(prod.readOnlyToolInvocationAttemptedWithHarmlessNumbers,true);
  assert.equal(prod.checks.filter(x=>/bearer-tools-call-denied/.test(x.id)).length,2);
  assert.equal(prod.checks.every(x=>x.actuallyProvesZeroInternalHostCalls===false),true);
  assert.equal(prod.checks.every(x=>x.liveValidJwtInvolved===false),true);
  assert.equal(manifest.providerTestProof.pullRequestCheckTestsPassed,252);
  assert.equal(manifest.providerTestProof.mergeCheckTestsPassed,252);
  assert.equal(manifest.providerTestProof.fiveLiveChecksNotEquivalentToFiveJwtNegativeVectors,true);
});
test('007-C separates local OAuth JWT claims and reports production gaps as unproven',()=>{
 const local=manifest.separateLocalOauthSecurityTests;
 assert.equal(local.cases.length,10);
 assert.equal(local.cases.every(x=>x.evidenceClass==='synthetic_local_test_executed_in_provider_ci'),true);
 assert.equal(local.cases.every(x=>x.productionLiveAdversarialVerified===false),true);
 assert.equal(local.realAuth0AdversarialTokenTested,false);
 const unverified=manifest.unverifiedProductionSecurityClaims;
 assert.ok(unverified.length>=10);
 assert.equal(new Set(unverified.map(x=>x.id)).size,unverified.length);
 assert.equal(unverified.every(x=>x.status==='not_proven_by_this_evidence'&&x.mustNotReportAsPassing),true);
 assert.equal(manifest.productionPositiveEvidence.actualAuthenticatedJwtClaimsCapturedForReview,false);
 assert.equal(manifest.productionPositiveEvidence.perChatGPTTurnMethodPayloadBoundToProviderLog,false);
 const findings=manifest.sourceEstablishedLifecycleDefects;
 assert.equal(findings.defects.length,2);
 assert.deepEqual(findings.defects.map(x=>x.id),['handler_local_concurrency_scope','jwks_cache_lost_each_request']);
 assert.equal(findings.defects.every(x=>x.fixImplementedInThisPr===false),true);
 assert.equal(findings.observedProductionLoadOrLatencyImpact,null);
 assert.equal(findings.remediationIssue,'https://github.com/Papa3445/Pro-Papa/issues/37');
 assert.equal(findings.defects[0].classification,'source_proven_ineffective_across_independent_netlify_requests');
 assert.equal(findings.defects[0].claimedMaximumAcrossRequests,null);
 assert.equal(findings.defects[0].edgeIpRateLimitSeparate,true);
 assert.equal(findings.defects[1].classification,'source_proven_no_cross_request_cache_reuse');
 assert.equal(findings.defects[1].documentedCacheSecondsWithinValidator,300);
 assert.equal(findings.defects[1].productionLatencyMeasuredMs,null);
 assert.equal(unverified.find(x=>x.id==='production_global_rate_limit_and_distributed_concurrency').knownDefectReference,'handler_local_concurrency_scope');
 assert.equal(manifest.riskBoundary.liveNewRequestsPerformedInThisGate,0);
 assert.equal(manifest.riskBoundary.credentialsHandledInThisGate,0);
 assert.equal(manifest.riskBoundary.responseEvidenceDoesNotProveAbsenceOfInternalExecution,true);
});
