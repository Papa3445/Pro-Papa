import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURED_PILOTS, runStructuredBenchmark } from '../bin/benchmark-structured-pp0007.mjs';

test('PP-0007 structured benchmark covers four real host handlers, not the original seven user tasks',async()=>{
  assert.deepEqual(STRUCTURED_PILOTS.map(x=>x.category),
    ['data','operations','document','software']);
  const report=await runStructuredBenchmark();
  assert.equal(report.mode,'deterministic_real_local_host');
  assert.equal(report.pilotCount,4);
  assert.equal(report.mechanicallyValidatedCompletions,4);
  assert.equal(report.structuredPilotCompletionRate,1);
  assert.equal(report.negativeTestsPassed,5);
  assert.equal(report.guardrailsPassed,true);
  assert.equal(report.hostCalls,9);
  assert.equal(report.realGitHubCallsObserved,0);
  assert.equal(report.externalToolCallsObserved,0);
  assert.equal(report.receiptCount,0);
  assert.equal(report.tokenUsage,null);
  assert.equal(report.directAssistantBaseline,null);
  assert.equal(report.correctiveInteractionsMeasured,false);
  assert.equal(report.historicSevenCaseCompletionRate,'2/7 unchanged; not measured by this script');
  assert.ok(report.pilots.every(x=>x.status==='completed'&&
    x.requirementMet&&x.provider==='local-node'&&x.auditStatus==='not_requested' &&
    x.hostCalls===1&&x.elapsedMs>=0));
  assert.ok(report.negatives.every(x=>x.status===x.expected&&x.passed));
  assert.ok(report.pilots.find(x=>x.id==='software').outputSummary.fileName==='parse-iso-date.mjs');
  assert.ok(report.pilots.find(x=>x.id==='memo').outputSummary.status==='draft_unverified');
  assert.ok(report.pilots.find(x=>x.id==='schedule').outputSummary.scheduledCount===2);
  // Emit a genuine, machine-readable provider log that can be pinned after CI.
  console.log('PP0007_STRUCTURED_REPORT_JSON='+JSON.stringify(report));
});
