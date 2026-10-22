#!/usr/bin/env node
// PP-0007: new, separate structured local-pilot measurements.
// This must never rewrite the historical seven-case baseline or simulate an LLM.
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createReferenceHost } from '../src/reference-host.mjs';

const WEEK='2026-10-26';
const MEMO={
  to:'Project coordination team',subject:'Weekly kickoff',
  purpose:'Organize supplied next steps without inventing facts.',
  facts:['Owners have not yet been confirmed.'],
  actions:['Confirm owners with stakeholders.'],
};
export const STRUCTURED_PILOTS=Object.freeze([
  {id:'calculation',category:'data',capability:'math.sum',
    objective:'Sum these three numeric inputs',inputs:{numbers:[2,3,5]}},
  {id:'schedule',category:'operations',capability:'plan.week',
    objective:'Draft an explicitly ordered week',inputs:{weekOf:WEEK,tasks:[
      {id:'scope',title:'Define scope'},
      {id:'review',title:'Review scope',dependsOn:['scope']},
    ]}},
  {id:'memo',category:'document',capability:'memo.draft',
    objective:'Format a draft from supplied notes',inputs:MEMO},
  {id:'software',category:'software',capability:'code.iso-date',
    objective:'Return a tested ISO calendar date parsing module',
    inputs:{examples:['2024-02-29','2025-02-29','2026-10-21']}},
]);

async function validate(caseId, output, provenance) {
  if (provenance?.provider!=='local-node') return false;
  if (caseId==='calculation')
    return output?.total===10 && output?.count===3;
  if (caseId==='schedule') {
    const x=output?.entries;
    return output?.weekOf===WEEK && output?.scheduledCount===2 &&
      output?.remainingDays===3 && Array.isArray(x) && x.length===2 &&
      x[0]?.date==='2026-10-26' && x[0]?.title==='Define scope' &&
      x[1]?.date==='2026-10-27' && x[1]?.id==='review' &&
      Array.isArray(x[1]?.dependsOn) && x[1].dependsOn.length===1 &&
      x[1].dependsOn[0]==='scope';
  }
  if (caseId==='memo') {
    const body=output?.text;
    return output?.status==='draft_unverified' &&
      output?.format==='plain-text' && output?.factCount===1 &&
      output?.actionCount===1 && typeof body==='string' &&
      body.startsWith('MEMORANDUM (DRAFT — UNVERIFIED)\nTo: Project coordination team\n') &&
      body.includes('Subject: Weekly kickoff\n') &&
      body.includes('\nProvided facts (not independently verified)\n1. Owners have not yet been confirmed.\n') &&
      body.includes('\nProposed actions (provided by requester)\n1. Confirm owners with stakeholders.\n') &&
      !body.includes('AUTHORIZED') && !body.includes('Signed by');
  }
  if (caseId==='software') {
    if (output?.moduleFormat!=='esm' || output?.fileName!=='parse-iso-date.mjs' ||
        output?.language!=='javascript' || typeof output?.source!=='string' ||
        !output.source.startsWith('export function parseIsoCalendarDate(') ||
        !Array.isArray(output?.examples) || output.examples.length!==3 ||
        output.examples[0]?.parsed?.weekday!=='Thu' ||
        output.examples[1]?.parsed!==null) return false;
    // Only the fixed generator-produced source is imported, not arbitrary user text.
    const loaded=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(output.source));
    return loaded.parseIsoCalendarDate('2024-02-29')?.weekday==='Thu' &&
      loaded.parseIsoCalendarDate('2025-02-29')===null &&
      loaded.parseIsoCalendarDate('2026-02-30')===null;
  }
  return false;
}
const round = n=>Math.round(n*1000)/1000;
export async function runStructuredBenchmark() {
  const host=createReferenceHost({githubResearch:false,auditMode:'off'});
  const pilots=[];
  for (const item of STRUCTURED_PILOTS) {
    const started=performance.now();
    const result=await host.execute({objective:item.objective,
      capability:item.capability,inputs:item.inputs});
    const duration=round(Math.max(0,performance.now()-started));
    const valid=result.status==='completed' &&
      result.capability===item.capability &&
      result.audit?.status==='not_requested' &&
      await validate(item.id,result.execution?.output,result.execution?.provenance);
    pilots.push({
      id:item.id,category:item.category,requestedCapability:item.capability,
      status:result.status,requirementMet:valid,
      mechanicalValidationPassed:valid,
      provider:result.execution?.provenance?.provider??null,
      auditStatus:result.audit?.status??null,
      hostCalls:1,elapsedMs:duration,
      persistedTask:false,externalEffectsObserved:0,
      outputSummary:item.id==='calculation'?{total:result.execution?.output?.total}:
        item.id==='schedule'?{scheduledCount:result.execution?.output?.scheduledCount}:
        item.id==='memo'?{status:result.execution?.output?.status}:
        {fileName:result.execution?.output?.fileName??null},
    });
  }
  const bad=[
    {id:'unstructured_qa',request:{objective:'What is the capital of France?',capability:'general'},expected:'unsupported'},
    {id:'unstructured_novel',request:{objective:'Analyze an unusual multidisciplinary problem',capability:'general'},expected:'unsupported'},
    {id:'unstructured_software',request:{objective:'Write arbitrary software',capability:'software'},expected:'unsupported'},
    {id:'unauthorized_issue',request:{objective:'Publish an issue',capability:'operations',
      inputs:{action:'github.create_issue',repository:'Papa3445/Pro-Papa',title:'No publication'}},expected:'denied'},
    {id:'memo_action_injection',request:{objective:'Publish memo',capability:'memo.draft',
      inputs:{...MEMO,action:'github.create_issue'}},expected:'provider_unavailable'},
  ];
  const negatives=[];
  for (const x of bad) {
    const response=await host.execute(x.request);
    negatives.push({id:x.id,status:response.status,expected:x.expected,
      passed:response.status===x.expected && !response.execution});
  }
  const completed=pilots.filter(x=>x.requirementMet).length;
  const valid=negatives.every(x=>x.passed)&&completed===STRUCTURED_PILOTS.length;
  return {
    schemaVersion:1,taskId:'PP-0007',kind:'structured-local-pilots-separate-from-canonical',
    mode:'deterministic_real_local_host',pilotCount:pilots.length,
    mechanicallyValidatedCompletions:completed,
    structuredPilotCompletionRate:round(completed/pilots.length),
    negativeCount:negatives.length,negativeTestsPassed:negatives.filter(x=>x.passed).length,
    hostCalls:pilots.length+negatives.length,externalToolCallsObserved:0,
    realGitHubCallsObserved:0,receiptCount:0,receiptScope:'auditMode off; no per-case receipts issued',
    totalHostElapsedMs:round(pilots.reduce((a,x)=>a+x.elapsedMs,0)),
    meanHostElapsedMs:round(pilots.reduce((a,x)=>a+x.elapsedMs,0)/pilots.length),
    actualHumanCorrections:null,correctiveInteractionsMeasured:false,
    tokenUsage:null,directAssistantBaseline:null,
    comparisonStatus:'not_performed_no_llm_provider_or_paired_direct_assistant_runs',
    historicSevenCaseCompletionRate:'2/7 unchanged; not measured by this script',
    qualityScope:'Deterministic mechanical checks and executable generated code only; no independent memo quality review or general multi-domain reasoning',
    limitations:'Four explicitly structured local tasks; excludes Q&A, novel user requests, live sourced research, publication, persistent writes, subjective content quality and true end-to-end ChatGPT comparison.',
    pilots,negatives,guardrailsPassed:valid,
  };
}
async function main(){
  if(process.argv.length>2)throw Error('Unknown structured benchmark argument');
  const report=await runStructuredBenchmark();
  console.log(JSON.stringify(report,null,2));
  if(!report.guardrailsPassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
  main().catch(()=>{console.log(JSON.stringify({status:'structured_pilot_failed'}));process.exitCode=1;});
