import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runRealHostOperatorSamples} from '../bin/pp0011-real-host-operator-samples.mjs';

test('PP-0011 operator samples are real gateway-traced output from four isolated host CLIs',()=>{
  const report=runRealHostOperatorSamples();
  assert.equal(report.status,'completed');
  assert.deepEqual(report.samples.map(x=>x.kind),
    ['document','planning','data','software']);
  assert.ok(report.samples.every(x=>x.hostStatus==='completed'&&
    x.traceState==='released'&&x.provider==='local-node'&&
    /^[0-9a-f]{64}$/.test(x.traceExecutionSha256)&&
    x.operatorQualityAcceptance===null));
  assert.equal(report.samples[0].artifact.status,'draft_unverified');
  assert.match(report.samples[0].artifact.text,/Sample review team/);
  assert.equal(report.samples[1].artifact.scheduledCount,3);
  assert.equal(report.samples[1].artifact.entries[2].date,'2026-11-11');
  assert.equal(report.samples[2].artifact.sum,44);
  assert.equal(report.samples[2].artifact.warning.includes('Not privacy-preserving'),true);
  assert.ok(report.samples[3].artifact.source.startsWith(
    'export function parseIsoCalendarDate('));
  assert.equal(report.samples[3].artifact.examples[1].parsed,null);
  assert.equal(report.limitations.operatorApprovalOfTheseHostOutputs,null);
  assert.equal(report.limitations.productionRollback,null);
});
test('PP-0011 actual host sample runner outputs bounded nonsensitive operator artifacts',()=>{
  const cli=fileURLToPath(new URL('../bin/pp0011-real-host-operator-samples.mjs',
    import.meta.url));
  const run=spawnSync(process.execPath,[cli],{encoding:'utf8',timeout:25000,
    maxBuffer:65536,env:{PATH:process.env.PATH??'/usr/bin:/bin',LANG:'C.UTF-8'}});
  assert.equal(run.status,0);
  assert.equal(run.stderr,'');
  const output=JSON.parse(run.stdout);
  assert.equal(output.samples.length,4);
  assert.equal(output.samples[1].artifact.entries[0].date,'2026-11-09');
  assert.equal(output.samples[3].artifact.examples[0].parsed.day,29);
  assert.ok(run.stdout.length<20000,'Operator sample output must be bounded');
  for(const text of ['GITHUB_TOKEN','PRO_PAPA_GATEWAY_SECRET','Authorization: Bearer']){
    assert.equal(run.stdout.includes(text),false,'No credential-field disclosure');
  }
  // Synthetic and explicitly safe to include in public GitHub Actions test logs.
  console.log('PP0011_ACTUAL_HOST_OPERATOR_SAMPLES '+JSON.stringify(output));
});
