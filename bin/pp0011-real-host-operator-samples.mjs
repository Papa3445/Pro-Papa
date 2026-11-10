#!/usr/bin/env node
// PP-0011: actual user-reviewable outputs from the real standalone reference-host CLI.
// All four inputs are synthetic, static and nonsensitive. No provider token is passed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const cli=fileURLToPath(new URL('./reference-host.mjs',import.meta.url));
const cases=[
  {
    kind:'document',capability:'memo.draft',
    request:{objective:'Draft a synthetic handoff for an operator quality review',
      capability:'memo.draft',inputs:{
        to:'Sample review team',subject:'Source-backed sample handoff',
        purpose:'Organize synthetic sample facts for operator review.',
        facts:['A sample dataset has four numeric values and one missing entry.',
          'This is a standalone reference-host demo, not a production deployment.'],
        actions:['Assess whether the draft helps with a routine handoff.',
          'Record limits and corrective feedback before production decisions.']
      }},
  },
  {
    kind:'planning',capability:'plan.week',
    request:{objective:'Schedule three illustrative tasks in a draft week',
      capability:'plan.week',inputs:{weekOf:'2026-11-09',tasks:[
        {id:'review',title:'Inspect sample outputs'},
        {id:'validate',title:'Check source identities and limitations',dependsOn:['review']},
        {id:'decide',title:'Record an acceptance or correction decision',dependsOn:['validate']}
      ]}},
  },
  {
    kind:'data',capability:'data.profile',
    request:{objective:'Analyze nonsensitive synthetic sample values',
      capability:'data.profile',inputs:{values:[8,12,null,10,14]}},
  },
  {
    kind:'software',capability:'code.iso-date',
    request:{objective:'Generate the fixed ISO date parser and validate examples',
      capability:'code.iso-date',inputs:{examples:[
        '2028-02-29','2026-02-30','2026-11-09'
      ]}},
  },
];
const authFreeEnv={
  PATH:process.env.PATH??'/usr/bin:/bin',LANG:'C.UTF-8',
};
function invokeHost({request,capability}){
  const r=spawnSync(process.execPath,
    [cli,'--enforce-trace',...(capability==='data.profile'?['--data-profile']:[])],
    {input:JSON.stringify(request),encoding:'utf8',timeout:15000,maxBuffer:65536,
      env:authFreeEnv});
  assert.equal(r.error,undefined,'Host subprocess must start');
  assert.equal(r.status,0,capability+' CLI did not successfully exit');
  assert.equal(r.stderr,'','No raw exceptions or secrets in host stderr');
  const reply=JSON.parse(r.stdout);
  assert.equal(reply.status,'completed',capability);
  assert.equal(reply.capability,capability);
  assert.equal(reply.audit.status,'not_requested');
  assert.equal(reply.execution.provenance.provider,'local-node');
  assert.equal(reply.execution.provenance.operation,capability);
  assert.equal(reply.trace.state,'released');
  assert.equal(verifyReleasedExecution(reply),true,'Host trace must pass independent local verifier');
  return reply;
}
export function runRealHostOperatorSamples(){
  const results=[];
  for(const c of cases){
    const reply=invokeHost(c);
    const out=reply.execution.output;
    let artifact;
    if(c.kind==='document'){
      assert.equal(out.status,'draft_unverified');
      assert.equal(out.factCount,2);
      assert.equal(out.actionCount,2);
      assert.match(out.text,/not independently verified/i);
      assert.match(out.text,/production deployment/);
      artifact={status:out.status,format:out.format,text:out.text,
        warning:out.limitations};
    }else if(c.kind==='planning'){
      assert.equal(out.weekOf,'2026-11-09');
      assert.equal(out.scheduledCount,3);
      assert.equal(out.remainingDays,2);
      assert.deepEqual(out.entries.map(x=>x.date),
        ['2026-11-09','2026-11-10','2026-11-11']);
      assert.deepEqual(out.entries[2].dependsOn,['validate']);
      artifact={weekOf:out.weekOf,timeBasis:out.timeBasis,
        scheduledCount:out.scheduledCount,remainingDays:out.remainingDays,
        entries:out.entries,warning:out.limitations};
    }else if(c.kind==='data'){
      assert.equal(out.sum,44);
      assert.equal(out.mean,11);
      assert.equal(out.median,11);
      assert.equal(out.numericCount,4);
      assert.equal(out.missingCount,1);
      assert.match(out.limitations,/Not privacy-preserving/);
      artifact={numericCount:out.numericCount,missingCount:out.missingCount,
        sum:out.sum,mean:out.mean,median:out.median,min:out.min,max:out.max,
        warning:out.limitations};
    }else if(c.kind==='software'){
      assert.equal(out.language,'javascript');
      assert.equal(out.moduleFormat,'esm');
      assert.equal(out.fileName,'parse-iso-date.mjs');
      assert.equal(out.examples[0].parsed.iso,'2028-02-29');
      assert.equal(out.examples[1].parsed,null);
      assert.equal(out.examples[2].parsed.iso,'2026-11-09');
      assert.match(out.source,/export function parseIsoCalendarDate/);
      artifact={fileName:out.fileName,language:out.language,
        moduleFormat:out.moduleFormat,
        sourceSha256:createHash('sha256').update(out.source).digest('hex'),
        source:out.source,examples:out.examples,warning:out.limitations};
    }else throw Error('Unknown fixed case');
    results.push({kind:c.kind,capability:c.capability,hostStatus:reply.status,
      provider:reply.execution.provenance.provider,traceState:reply.trace.state,
      traceExecutionSha256:reply.trace.executionSha256,artifact,
      operatorQualityAcceptance:null});
  }
  return {
    schemaVersion:1,taskId:'PP-0011',kind:'actual-isolated-reference-host-operator-samples',
    execution:'four independent invocations of bin/reference-host.mjs --enforce-trace',
    status:'completed',auditRequired:false,
    identity:'actual host output from pinned CI source; CI run SHA must be confirmed externally',
    samples:results,
    limitations:{
      nativeChatGPTToolOutput:false,productionHost:false,
      liveGitHubResearchInThisRun:false,authenticationProviderEvidence:false,
      operatorApprovalOfTheseHostOutputs:null,productionRollback:null,
      statisticalSuperiority:null,
      numericalAggregationIsPrivacyPreserving:false,
    },
  };
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  try{console.log(JSON.stringify(runRealHostOperatorSamples()));}
  catch{console.error('PP-0011 actual host sample execution failed');process.exitCode=1;}
}
