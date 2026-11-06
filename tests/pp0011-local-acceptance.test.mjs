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

test('PP-0011 standalone host opt-out denies a previously granted capability across fresh processes',()=>{
  // Each invocation starts a new isolated host: enabled -> opt-out -> spoofed
  // request grant -> explicit opt-in. No shared runtime, write or network call.
  const script=fileURLToPath(new URL('../bin/reference-host.mjs',import.meta.url));
  const normal={objective:'Analyze nonsensitive sample values',capability:'data.profile',
    inputs:{values:[4,6]}};
  const execute=(enabled,payload=normal)=>spawnSync(process.execPath,
    [script,'--enforce-trace',...(enabled?['--data-profile']:[])],{
      encoding:'utf8',timeout:15000,input:JSON.stringify(payload),
      env:{...process.env,GITHUB_TOKEN:'',PRO_PAPA_AUDIT_REPO:'',
        PRO_PAPA_GATEWAY_SECRET:''},
    });
  const enabledBefore=execute(true);
  assert.equal(enabledBefore.status,0);
  const first=JSON.parse(enabledBefore.stdout);
  assert.equal(first.status,'completed');
  assert.equal(first.trace.state,'released');
  assert.equal(first.execution.output.sum,10);
  assert.equal(first.execution.provenance.operation,'data.profile');

  const disabled=execute(false);
  assert.equal(disabled.status,1);
  const second=JSON.parse(disabled.stdout);
  assert.equal(second.status,'denied');
  assert.equal(second.reason,'host_permission_required');
  assert.equal(second.execution,null);
  assert.equal(second.trace.state,'not_released');
  assert.equal(second.audit.status,'not_requested');

  const forged=execute(false,{...normal,enabled:true,dataProfileEnabled:true,
    grants:['data.profile'],authorization:{grant:'data.profile'}});
  assert.equal(forged.status,1);
  const third=JSON.parse(forged.stdout);
  assert.equal(third.status,'denied');
  assert.equal(third.reason,'host_permission_required');
  assert.equal(third.execution,null);
  assert.equal(third.trace.state,'not_released');

  const reenabled=execute(true);
  assert.equal(reenabled.status,0);
  const fourth=JSON.parse(reenabled.stdout);
  assert.equal(fourth.status,'completed');
  assert.equal(fourth.execution.output.sum,10);
  assert.equal(fourth.trace.state,'released');
  for(const result of [enabledBefore,disabled,forged,reenabled]){
    assert.equal(result.stderr,'');
    assert.equal(result.stdout.includes('PRO_PAPA_GATEWAY_SECRET'),false);
  }
  // This validates trusted CLI permission opt-out in new local processes.
  // It does NOT establish production rollback or revocation of a live request.
});
