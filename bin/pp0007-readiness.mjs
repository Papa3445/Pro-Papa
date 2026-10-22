#!/usr/bin/env node
// PP-0007: fail-closed evaluation of two *noncomparable* historical measurements.
// No baseline is inferred or generated; no model or outside service is called.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { CASES } from './benchmark-pp0007.mjs';
import { STRUCTURED_PILOTS } from './benchmark-structured-pp0007.mjs';

const root = new URL('../', import.meta.url);
const canonicalPath = '.pro-papa/evidence/PP-0007/deterministic-fixtures.json';
const structuredPath = '.pro-papa/evidence/PP-0007/structured-local-observation.json';
const digest = s => createHash('sha256').update(s,'utf8').digest('hex');
const guard = (v,msg) => { if (!v) throw Error('PP-0007 evidence integrity failure: '+msg); };
const ids = a => a.map(x=>x.id);
const sameIds = (a,b) => JSON.stringify(ids(a))===JSON.stringify(ids(b));
const exactInts = (a,keys) => keys.every(k=>Number.isSafeInteger(a[k])&&a[k]>=0);

// Reviewer-verified immutable historical snapshots, not values read from the same
// mutable observation. A revised report requires new independently approved hashes.
// Digests are content-integrity pins, NOT authentication of GitHub or output quality.
const ORIGINAL_RAW_SHA256='46c51e3c91c02c3a1a21cd836dbfba8228552ed528e4abcccc99fc69543bd80c';
const STRUCTURED_RAW_SHA256='62e3446a49dac2fe6d8b676142b3c94b0101aaf118206f4c43b7c238a283f41e';
const ORIGINAL_PARSED_SHA256='cc180231d058d56765ce07aa2cbf0debb006dc6a6baa2359845bce75591f1052';
const STRUCTURED_PARSED_SHA256='3ef3a906920b858b7247394eaab83a5942ea1035bbf3c77cb933db26801920c4';
const NEGATIVE_ORACLE=Object.freeze([
  ['unstructured_qa','unsupported'],
  ['unstructured_novel','unsupported'],
  ['unstructured_software','unsupported'],
  ['unauthorized_issue','denied'],
  ['memo_action_injection','provider_unavailable'],
]);
const finiteMs=x=>typeof x==='number' && Number.isFinite(x) && x>=0;
function pinnedObject(value, expected, name){
  let serialized;
  try { serialized=JSON.stringify(value); } catch { guard(false,name); }
  guard(typeof serialized==='string' && digest(serialized)===expected,name);
}

export function analyzeReadiness(canonical,manifest) {
  // Fail closed on ANY changed historical field, not just summary counters.
  pinnedObject(canonical,ORIGINAL_PARSED_SHA256,'pinned canonical historical observation');
  pinnedObject(manifest,STRUCTURED_PARSED_SHA256,'pinned structured historical observation');
  guard(canonical && canonical.taskId==='PP-0007' &&
    canonical.mode==='deterministic_fake_github' &&
    canonical.kind==='reproducible-bounded-host-pilot' && canonical.guardrailsPassed===true,
    'original report identity');
  guard(canonical.pilotCount===7 && Array.isArray(canonical.pilots) &&
    sameIds(CASES,canonical.pilots) &&
    exactInts(canonical,['pilotCount','successfulUserTasks','safelyUnsupported','receiptCount']),
    'original report completeness');
  guard(canonical.pilots.every((p,i)=>p.requestedCapability===CASES[i].capability &&
    p.validationPassed===true && p.status===CASES[i].expected &&
    p.requirementMet===(p.status==='completed') &&
    p.safeFailure===(p.status!=='completed')),
    'original individual outcomes');
  guard(canonical.successfulUserTasks===canonical.pilots.filter(p=>p.requirementMet).length &&
    canonical.safelyUnsupported===canonical.pilots.filter(p=>p.safeFailure).length &&
    canonical.successfulUserTasks===2 && canonical.safelyUnsupported===5 &&
    canonical.directAssistantBaseline===null && canonical.tokenUsage===null &&
    canonical.receiptCount===0 && canonical.totalGitHubCallsObserved===0,
    'original measurements cannot be silently upgraded');

  guard(manifest && manifest.schemaVersion===1 && manifest.taskId==='PP-0007' &&
    manifest.kind==='structured-local-provider-observation' &&
    manifest.githubActions?.event==='pull_request' &&
    /^[a-f0-9]{40}$/.test(manifest.sourceHeadAtMeasurement) &&
    manifest.githubActions?.headSha===manifest.sourceHeadAtMeasurement &&
    exactInts(manifest.githubActions,['runId','jobId','tests','passed','failed','skipped']) &&
    manifest.githubActions.passed===156 && manifest.githubActions.failed===0 &&
    manifest.githubActions.skipped===0 && manifest.githubActions.projectValid===true,
    'structured run identity');
  const s=manifest.observedReport;
  guard(s && s.kind==='structured-local-pilots-separate-from-canonical' &&
    s.mode==='deterministic_real_local_host' && s.guardrailsPassed===true &&
    Array.isArray(s.pilots) && sameIds(STRUCTURED_PILOTS,s.pilots) &&
    s.pilotCount===4 && s.mechanicallyValidatedCompletions===4 &&
    s.pilots.every((p,i)=>p.status==='completed' &&
      p.requestedCapability===STRUCTURED_PILOTS[i].capability &&
      p.mechanicalValidationPassed===true && p.provider==='local-node' &&
      p.auditStatus==='not_requested') &&
    Array.isArray(s.negatives) && s.negatives.length===5 &&
    s.negatives.every((x,i)=>x.id===NEGATIVE_ORACLE[i][0] &&
      x.expected===NEGATIVE_ORACLE[i][1] && x.status===NEGATIVE_ORACLE[i][1] &&
      x.passed===true) &&
    s.negativeTestsPassed===5 && s.hostCalls===9 &&
    s.externalToolCallsObserved===0 && s.realGitHubCallsObserved===0 &&
    s.receiptCount===0 && s.tokenUsage===null &&
    s.directAssistantBaseline===null && s.correctiveInteractionsMeasured===false &&
    s.historicSevenCaseCompletionRate==='2/7 unchanged; not measured by this script' &&
    finiteMs(s.totalHostElapsedMs) && finiteMs(s.meanHostElapsedMs) &&
    s.pilots.every((p,i)=>finiteMs(p.elapsedMs) && p.hostCalls===1 &&
      p.persistedTask===false && p.externalEffectsObserved===0 &&
      JSON.stringify(p.outputSummary)===JSON.stringify([
        {total:10},{scheduledCount:2},{status:'draft_unverified'},
        {fileName:'parse-iso-date.mjs'}][i])) &&
    canonical.pilots.every((p,i)=>finiteMs(p.elapsedMs) &&
      p.auditStatus==='not_requested' && p.persistedTask===false &&
      p.provenanceProvider===(['qa','research','software','document','data','planning','novel'][i]==='research'?'github':
        i===4?'local-node':null)),
    'structured local-only outcomes');
  guard(CASES.length===7 && STRUCTURED_PILOTS.length===4 &&
    CASES.some(c=>c.id==='qa') && CASES.some(c=>c.id==='novel') &&
    !STRUCTURED_PILOTS.some(c=>c.id==='qa'||c.id==='novel'),
    'noncomparable fixture definitions');
  return {
    schemaVersion:1,taskId:'PP-0007',kind:'evidence-readiness-gap-assessment',
    evaluated: {canonical:'seven original unstructured requests; mock research',
      structured:'four distinct explicit-input local tasks',comparableTasks:false},
    canonicalUserRequests:{count:7,completed:2,safelyUnsupported:5,
      completionRate:Math.round(2/7*1000)/1000},
    separateStructuredLocalTasks:{count:4,mechanicallyValidated:4,
      negativeCallsValidated:5,hostCalls:9,
      observedTotalHostMs:s.totalHostElapsedMs},
    measuredDirectAssistantBaseline:false,
    realPerPilotAuditReceipts:0,
    correctiveInteractionCounts:null,tokenUsage:null,
    evidenceIntegrityChecked:true,
    conditions:[
      {id:'six-domain-general-user-outcomes',met:false,
        reason:'Only 2 of 7 original freeform user requests completed; structured pilots are different requests'},
      {id:'per-pilot-audit-and-output-quality',met:false,
        reason:'Structured run disabled audit and checks mechanically, not independent response quality'},
      {id:'paired-assistant-outcomes-and-cost',met:false,
        reason:'No authentic direct-assistant paired trial, correction/latency parity, or LLM token measurements'},
      {id:'final-independent-milestone-review',met:false,
        reason:'Previous scoped approvals do not independently close PP-0007'},
    ],
    milestoneAcceptanceMet:false,
    comparativeSuperiority:'not_established',
    nextEvidence:'Collect matching real direct-assistant trials for identical tasks, verify output with independent grader and actual tool/latency/correction/token evidence where available.',
  };
}
export async function loadReadiness() {
  const [canonicalRaw,structuredRaw,source,tests] = await Promise.all([
    readFile(new URL(canonicalPath,root),'utf8'),
    readFile(new URL(structuredPath,root),'utf8'),
    readFile(new URL('bin/benchmark-structured-pp0007.mjs',root),'utf8'),
    readFile(new URL('tests/benchmark-structured-pp0007.test.mjs',root),'utf8'),
  ]);
  // Fixed byte digests independently anchored in the preceding reviewed evidence.
  // Self-consistent edits to both the report and its embedded source hashes fail.
  guard(digest(canonicalRaw)===ORIGINAL_RAW_SHA256 &&
    digest(structuredRaw)===STRUCTURED_RAW_SHA256,
    'historical original/structured report byte hashes');
  const canonical=JSON.parse(canonicalRaw),structured=JSON.parse(structuredRaw);
  guard(structured.source?.path==='bin/benchmark-structured-pp0007.mjs' &&
    structured.tests?.path==='tests/benchmark-structured-pp0007.test.mjs' &&
    structured.source.sha256===digest(source) &&
    structured.tests.sha256===digest(tests),
    'structured source/test SHA-256 (local, not remote GitHub attestation)');
  const result=analyzeReadiness(canonical,structured);
  return { ...result,sourceIntegrity:{
    structuredSourceSha256:digest(source),
    structuredTestsSha256:digest(tests),
    canonicalReportSha256:digest(canonicalRaw),
    structuredObservationSha256:digest(structuredRaw),
    note:'Locally recomputed SHA-256 matches independently reviewed pinned historical bytes, but GitHub provider identity is not queried by this CLI',
  }};
}
async function main(){
  if(process.argv.length!==2)throw Error('No file override or baseline fabrication permitted');
  const result=await loadReadiness();
  console.log(JSON.stringify(result,null,2));
  // Integrity success != PP-0007 milestone acceptance.
  if(result.milestoneAcceptanceMet)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
  main().catch(()=>{console.log(JSON.stringify({status:'readiness_integrity_failed'}));process.exitCode=1;});
