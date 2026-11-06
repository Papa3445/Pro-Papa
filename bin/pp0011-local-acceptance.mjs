#!/usr/bin/env node
// PP-0011: only actual standalone host calls, with no user data, storage, or network.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReferenceHost} from '../src/reference-host.mjs';
import {parseIsoCalendarDate} from '../src/iso-date.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const request=(objective,capability,inputs)=>({objective,capability,inputs});
const completed=(r,cap)=>{
  assert.equal(r.status,'completed',cap);
  assert.equal(r.capability,cap);
  assert.equal(r.execution?.provenance?.provider,'local-node');
  assert.equal(r.execution?.provenance?.operation,cap);
  assert.equal(r.audit?.status,'not_requested');
  assert.equal(verifyReleasedExecution(r),true,cap);
  return r.execution.output;
};
const blocked=(r,status)=>{
  assert.equal(r.status,status);
  assert.equal(r.execution,null);
  assert.equal(r.trace?.state,'not_released');
};
export async function runLocalAcceptance(){
  const host=createReferenceHost({dataProfileEnabled:true,traceMode:'enforced'});
  const out=[];
  const data=completed(await host.execute(request('Profile nonsensitive sample numbers',
    'data.profile',{values:[2,null,3,5]})),'data.profile');
  assert.equal(data.sum,10);
  assert.equal(data.numericCount,3);
  assert.equal(data.missingCount,1);
  assert.equal(data.mean,10/3);
  assert.equal(data.median,3);
  assert.match(data.limitations,/Not privacy-preserving/);
  out.push({domain:'data',capability:'data.profile',result:'completed',
    technicalChecks:{sum:10,numericCount:3,missingCount:1,median:3,privacyWarning:true},
    qualityReviewedByOwner:null});
  const doc=completed(await host.execute(request('Draft a sample team handoff note',
    'memo.draft',{to:'Sample team',subject:'Sample handoff',
      purpose:'Review nonsensitive work examples.',
      facts:['Two examples are documented','Production remains disabled'],
      actions:['Inspect results','Request human acceptance']})),'memo.draft');
  assert.equal(doc.status,'draft_unverified');
  assert.equal(doc.factCount,2);
  assert.equal(doc.actionCount,2);
  assert.match(doc.text,/Two examples are documented/);
  assert.match(doc.text,/Request human acceptance/);
  assert.match(doc.text,/not independently verified/i);
  out.push({domain:'document',capability:'memo.draft',result:'completed',
    technicalChecks:{status:doc.status,factCount:2,actionCount:2,
      suppliedFactsAndActionsPreserved:true},qualityReviewedByOwner:null});
  const plan=completed(await host.execute(request('Draft a synthetic week with dependencies',
    'plan.week',{weekOf:'2026-11-02',tasks:[
      {id:'prepare',title:'Prepare examples'},
      {id:'validate',title:'Validate outputs',dependsOn:['prepare']},
      {id:'review',title:'Request review',dependsOn:['validate']}
    ]})),'plan.week');
  assert.equal(plan.scheduledCount,3);
  assert.equal(plan.remainingDays,2);
  assert.deepEqual(plan.entries.map(x=>x.date),
    ['2026-11-02','2026-11-03','2026-11-04']);
  assert.deepEqual(plan.entries[2].dependsOn,['validate']);
  out.push({domain:'planning',capability:'plan.week',result:'completed',
    technicalChecks:{scheduledCount:3,remainingDays:2,datesAndDependenciesValid:true},
    qualityReviewedByOwner:null});
  const code=completed(await host.execute(request('Generate bounded ISO calendar parser',
    'code.iso-date',{examples:['2026-11-06','2028-02-29','2026-02-30']})),'code.iso-date');
  assert.equal(code.language,'javascript');
  assert.equal(code.source,'export '+parseIsoCalendarDate.toString()+'\n');
  assert.equal(code.examples[0].parsed.iso,'2026-11-06');
  assert.equal(code.examples[1].parsed.day,29);
  assert.equal(code.examples[2].parsed,null);
  out.push({domain:'software',capability:'code.iso-date',result:'completed',
    technicalChecks:{sourceMatchesFixedTemplate:true,leapDayAccepted:true,
      invalidDateRejected:true},qualityReviewedByOwner:null});

  const research=await host.execute(request('Read repository metadata',
    'research',{repository:'Papa3445/Pro-Papa'}));
  blocked(research,'denied');
  const write=await host.execute(request('Create an unapproved issue',
    'operations',{action:'github.create_issue',repository:'Papa3445/Pro-Papa',
      title:'Never create this issue'}));
  blocked(write,'denied');
  const invalid=await host.execute(request('Reject invalid sample numbers',
    'data.profile',{values:['UNSAFE-PAYLOAD-NEVER-LOG']}));
  blocked(invalid,'provider_unavailable');
  const recovered=completed(await host.execute(request('Recover stateless read-only analysis',
    'data.profile',{values:[2,null,3,5]})),'data.profile');
  assert.equal(recovered.sum,10);

  return {schemaVersion:1,taskId:'PP-0011',status:'pass',
    source:'actual standalone reference-host handlers',environment:'stateless local host',
    cases:out,
    negatives:{ungrantedResearch:research.status,unapprovedWrite:write.status,
      malformedData:invalid.status,executionReleased:false},
    recovery:{validRetry:'completed',sum:recovered.sum,distributedRollbackVerified:false},
    limits:{liveResearchInThisRun:false,nativeChatGPTOutputMeasured:false,
      ownerQualityAcceptance:null,comparisonWithDirectAssistant:null,
      latencyMs:null,tokenUsage:null,productionRollbackExecuted:false,
      privacyPreservingStatistics:false}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  runLocalAcceptance().then(x=>console.log(JSON.stringify(x))).catch(()=>{
    console.error('PP-0011 local smoke failed');
    process.exitCode=1;
  });
}
