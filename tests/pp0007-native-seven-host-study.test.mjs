// PP-0007: real per-case host execution at CI runtime, no LLM or mock transport.
// CI stdout contains status/provenance only; never direct ChatGPT screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostOne } from '../bin/pp0007-host-observation.mjs';
import { canonicalTrial } from '../bin/pp0007-api-baseline.mjs';

const expected = [
  ['qa', 'unsupported'],
  ['research', 'denied'],
  ['software', 'unsupported'],
  ['document', 'unsupported'],
  ['data', 'completed'],
  ['planning', 'denied'],
  ['novel', 'unsupported'],
];

test('PP-0007 seven frozen original cases execute through real native host', async () => {
  const records = [];
  for (const [id, expectedStatus] of expected) {
    const canonical = await canonicalTrial(id);
    const observed = await runHostOne({id});
    assert.equal(observed.transport, 'native_reference_host', id);
    assert.equal(observed.authenticity,
      'local_host_execution_not_independent_quality_grade', id);
    assert.equal(observed.resultStatus, expectedStatus, id);
    assert.equal(observed.objectiveSha256, canonical.objectiveSha256, id);
    assert.equal(observed.inputsSha256, canonical.inputsSha256, id);
    assert.equal(observed.fixtureGitBlobSha, canonical.fixtureGitBlobSha, id);
    assert.equal(observed.auditStatus, 'not_requested', id);
    assert.equal(observed.githubTransportAttemptsObserved, 0, id);
    assert.equal(observed.persistenceObserved, false, id);
    assert.equal(observed.taskSuccess, null, id);
    assert.equal(observed.qualityGrade, null, id);
    assert.equal(observed.providerReportedTokens, null, id);
    assert.ok(Number.isFinite(observed.latencyMs) && observed.latencyMs >= 0, id);
    if (id === 'data') {
      assert.deepEqual(observed.execution?.output, {total:10,count:3});
      assert.equal(observed.execution.provenance.provider, 'local-node');
    } else assert.equal(observed.execution, null, id);
    records.push({
      id, status:observed.resultStatus, expectedStatus,
      latencyMs:observed.latencyMs,
      objectiveSha256:observed.objectiveSha256,
      inputsSha256:observed.inputsSha256,
      fixtureGitBlobSha:observed.fixtureGitBlobSha,
      githubTransportAttemptsObserved:observed.githubTransportAttemptsObserved,
      auditStatus:observed.auditStatus,
      persistenceObserved:observed.persistenceObserved,
      taskSuccess:null,
      providerReportedTokens:null,
    });
  }
  assert.equal(records.length, 7);
  assert.equal(records.filter(x=>x.status==='completed').length, 1);
  console.log('PP0007_NATIVE_SEVEN_CASE_RESULTS='+JSON.stringify({
    schemaVersion:1, observationKind:'real_local_reference_host_not_quality_grading',
    executedCases:records.length, completedHandlerCases:1,
    caseResults:records,
    limitations:'Not a quality score, provider-attested ChatGPT baseline, or matched latency experiment.'
  }));
});

test('PP-0007 separate explicitly granted native research attempt is not silently relabeled', async () => {
  const observed = await runHostOne({id:'research', githubRead:true});
  assert.equal(observed.transport, 'native_reference_host');
  assert.equal(observed.githubReadAuthorized, true);
  assert.equal(observed.githubTransportAttemptsObserved, 1);
  assert.equal(observed.toolPermissionsComparableToApiBaseline, false);
  assert.equal(observed.taskSuccess, null);
  assert.equal(observed.privateUsageReceipt, null);
  assert.ok(['completed','provider_unavailable'].includes(observed.resultStatus));
  if (observed.resultStatus==='completed') {
    assert.equal(observed.execution.output.repository,'Papa3445/Pro-Papa');
  } else assert.equal(observed.execution, null);
  console.log('PP0007_NATIVE_GRANTED_RESEARCH='+JSON.stringify({
    status:observed.resultStatus, latencyMs:observed.latencyMs,
    githubTransportAttemptsObserved:observed.githubTransportAttemptsObserved,
    independentlyConfirmedNetworkRequests:observed.githubNetworkRequestsIndependentlyConfirmed,
    permissionAsymmetry:true, taskSuccess:null,
    providerReportedTokens:null,
    limitations:'Real native single GET attempt; instrumented invocation does not independently attest packets sent.'
  }));
});
