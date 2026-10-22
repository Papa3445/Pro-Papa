import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeReadiness, loadReadiness } from '../bin/pp0007-readiness.mjs';

const actual=async()=>{
  const [a,b]=await Promise.all([
    readFile(new URL('../.pro-papa/evidence/PP-0007/deterministic-fixtures.json',import.meta.url),'utf8'),
    readFile(new URL('../.pro-papa/evidence/PP-0007/structured-local-observation.json',import.meta.url),'utf8')]);
  return [JSON.parse(a),JSON.parse(b)];
};
const copy = x=>JSON.parse(JSON.stringify(x));

test('PP-0007 readiness auditor reports real noncomparable case coverage and unresolved acceptance',async()=>{
  const a=await loadReadiness();
  assert.equal(a.kind,'evidence-readiness-gap-assessment');
  assert.deepEqual(a.canonicalUserRequests,{count:7,completed:2,safelyUnsupported:5,completionRate:0.286});
  assert.equal(a.separateStructuredLocalTasks.mechanicallyValidated,4);
  assert.equal(a.separateStructuredLocalTasks.negativeCallsValidated,5);
  assert.equal(a.separateStructuredLocalTasks.hostCalls,9);
  assert.equal(a.evaluated.comparableTasks,false);
  assert.equal(a.measuredDirectAssistantBaseline,false);
  assert.equal(a.milestoneAcceptanceMet,false);
  assert.equal(a.comparativeSuperiority,'not_established');
  assert.equal(a.conditions.length,4);
  assert.ok(a.conditions.every(c=>c.met===false));
  assert.match(a.sourceIntegrity.note,/not independently queried/);
  assert.match(a.sourceIntegrity.structuredSourceSha256,/^[a-f0-9]{64}$/);
  console.log('PP0007_READINESS_REPORT_JSON='+JSON.stringify(a));
});
test('PP-0007 missing or fabricated original baseline cannot become comparative success',async()=>{
  const [canon,study]=await actual();
  for(const rewrite of [
    x=>{x.successfulUserTasks=5},
    x=>{x.pilots[2].requirementMet=true},
    x=>{x.pilots[0].status='completed'},
    x=>{x.directAssistantBaseline={completed:7,model:'fabricated'}},
    x=>{x.receiptCount=7},
    x=>{x.pilots.reverse()},
  ]){const bad=copy(canon);rewrite(bad);assert.throws(()=>analyzeReadiness(bad,study),/integrity failure/);}
});
test('PP-0007 structured mock quality, receipts or LLM baseline cannot silently overwrite data',async()=>{
  const [canon,study]=await actual();
  for(const rewrite of [
    x=>{x.observedReport.mechanicallyValidatedCompletions=7},
    x=>{x.observedReport.pilots[2].mechanicalValidationPassed=false},
    x=>{x.observedReport.negativeTestsPassed=4},
    x=>{x.observedReport.directAssistantBaseline={completed:4}},
    x=>{x.observedReport.receiptCount=4},
    x=>{x.observedReport.pilots[0].provider='github'},
    x=>{x.githubActions.headSha='a'.repeat(40)},
  ]){const bad=copy(study);rewrite(bad);assert.throws(()=>analyzeReadiness(canon,bad),/integrity failure/);}
});
