import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runLocalAcceptance} from '../bin/pp0011-local-acceptance.mjs';

test('PP-0011 genuine four-domain host output and permissions smoke',async()=>{
  const x=await runLocalAcceptance();
  assert.equal(x.status,'pass');
  assert.deepEqual(x.cases.map(y=>y.domain),['data','document','planning','software']);
  assert.ok(x.cases.every(y=>y.result==='completed'&&y.qualityReviewedByOwner===null));
  assert.equal(x.cases[0].technicalChecks.privacyWarning,true);
  assert.equal(x.cases[1].technicalChecks.status,'draft_unverified');
  assert.equal(x.cases[2].technicalChecks.datesAndDependenciesValid,true);
  assert.equal(x.cases[3].technicalChecks.invalidDateRejected,true);
  assert.deepEqual(x.negatives,{
    ungrantedResearch:'denied',unapprovedWrite:'denied',
    malformedData:'provider_unavailable',executionReleased:false,
  });
  assert.equal(x.recovery.validRetry,'completed');
  assert.equal(x.recovery.sum,10);
  assert.equal(x.recovery.distributedRollbackVerified,false);
  assert.equal(x.limits.ownerQualityAcceptance,null);
  assert.equal(x.limits.liveResearchInThisRun,false);
  assert.equal(x.limits.productionRollbackExecuted,false);
});
test('PP-0011 executable acceptance CLI emits summaries but never raw prompt payloads',()=>{
  const script=fileURLToPath(new URL('../bin/pp0011-local-acceptance.mjs',import.meta.url));
  const x=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:15000,
    env:{...process.env,GITHUB_TOKEN:'',PRO_PAPA_AUDIT_REPO:''}});
  assert.equal(x.status,0);
  assert.equal(x.stderr,'');
  const result=JSON.parse(x.stdout);
  assert.equal(result.status,'pass');
  assert.equal(result.cases.length,4);
  assert.equal(x.stdout.includes('UNSAFE-PAYLOAD-NEVER-LOG'),false);
  assert.equal(x.stdout.includes('Never create this issue'),false);
  assert.equal(x.stdout.includes('Two examples are documented'),false);
});
