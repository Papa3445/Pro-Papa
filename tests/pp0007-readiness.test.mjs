import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeReadiness, loadReadiness } from '../bin/pp0007-readiness.mjs';
import { CASES } from '../bin/benchmark-pp0007.mjs';

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
  assert.match(a.sourceIntegrity.note,/not queried by this CLI/);
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


test('PP-0007 P2 review: independent safe-status oracle refuses laundering of negatives',async()=>{
  const [canonical,structured]=await actual();
  for (const alter of [
    x=>{const p=x.observedReport.negatives[3];p.expected='completed';p.status='completed';p.passed=true;},
    x=>{x.observedReport.negatives[3].id='harmless_case';},
    x=>{x.observedReport.negatives[4].expected='completed';x.observedReport.negatives[4].status='completed';},
    x=>{x.observedReport.negatives.reverse();},
  ]){const modified=copy(structured);alter(modified);
    assert.throws(()=>analyzeReadiness(canonical,modified),/integrity failure/);}
});
test('PP-0007 P2 review: changed output, timing, audit, provenance and source metadata refuse integrity proof',async()=>{
  const [canonical,structured]=await actual();
  for(const mutate of [
    x=>{x.observedReport.totalHostElapsedMs=-9999;},
    x=>{x.observedReport.totalHostElapsedMs='4.749';},
    x=>{x.observedReport.meanHostElapsedMs=Infinity;},
    x=>{x.observedReport.pilots[0].outputSummary.total=999;},
    x=>{x.observedReport.pilots[2].outputSummary.status='approved';},
    x=>{x.observedReport.pilots[0].elapsedMs=-1;},
    x=>{x.observedReport.pilots[1].auditStatus='confirmed';},
    x=>{x.source.sha256='0'.repeat(64);},
    x=>{x.githubActions.runId=1;},
  ]){const modified=copy(structured);mutate(modified);
    assert.throws(()=>analyzeReadiness(canonical,modified),/integrity failure/);}
  for(const mutate of [
    x=>{x.pilots[1].auditStatus='confirmed';},
    x=>{x.pilots[1].provenanceProvider='untrusted-fixture';},
    x=>{x.pilots[4].outputSummary.total=999;},
    x=>{x.pilots[4].elapsedMs=-100;},
    x=>{x.pilots[1].transportCalls=0;},
    x=>{x.meanHostTimeMs=-99;},
    x=>{x.negatives[2].status='completed';x.negatives[2].passed=true;},
  ]){const modified=copy(canonical);mutate(modified);
    assert.throws(()=>analyzeReadiness(modified,structured),/integrity failure/);}
});

test('PP-0007 matched direct-assistant trial template keeps all seven original tasks and no invented outputs',async()=>{
  const raw=await readFile(new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url),'utf8');
  const template=JSON.parse(raw);
  assert.equal(template.kind,'prospective-matched-trial-collection-template');
  assert.equal(template.status,'not_collected');
  assert.equal(template.taskId,'PP-0007');
  assert.equal(template.collection.baselineExecutionCount,0);
  assert.equal(template.collection.proPapaNewExecutionCount,0);
  for(const value of ['modelName','modelVersion','modelSettings','fixtureFreezeCommit',
    'testEnvironment','comparableToolPermissions','externalProviderRecordUri']){
    assert.equal(template.collection[value],null);
  }
  assert.equal(template.trials.length,CASES.length);
  for(let i=0;i<CASES.length;i++){
    const x=CASES[i],t=template.trials[i];
    assert.equal(t.id,x.id);
    assert.equal(t.category,x.category);
    assert.equal(t.canonicalObjective,x.objective);
    assert.equal(t.canonicalCapability,x.capability);
    assert.deepEqual(t.canonicalInputs,x.inputs??null);
    for(const k of ['baselineTrial','hostTrial','independentQualityAssessment','correctionInteractions',
      'latencyMs','toolCalls','providerReportedTokens','observedComparison'])assert.equal(t[k],null);
  }
  assert.equal(new Set(template.trials.map(x=>x.id)).size,7);
});
