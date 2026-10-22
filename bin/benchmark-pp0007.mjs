#!/usr/bin/env node
// PP-0007 cross-domain pilot: measured execution, never a synthetic LLM baseline.
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, loadProject } from '../src/core.mjs';
import { createReferenceHost } from '../src/reference-host.mjs';

const REPOSITORY = 'Papa3445/Pro-Papa';
const FIXTURE_REPO = Object.freeze({
  id: 1427703038, full_name: REPOSITORY, private: false,
  html_url: 'https://github.com/' + REPOSITORY,
  description: 'Synthetic repository metadata fixture',
  stargazers_count: 6, open_issues_count: 1,
});
export const CASES = Object.freeze([
  { id: 'qa', category: 'quick Q&A', capability: 'general',
    objective: 'What is the capital city of France?', expected: 'unsupported',
    validation: 'No factual Q&A handler exists' },
  { id: 'research', category: 'sourced research', capability: 'research',
    objective: 'Research repository metadata with a provider URL',
    inputs: { repository: REPOSITORY }, expected: 'completed',
    validation: 'Repository identity and provider URL are checked; not a multi-source synthesis' },
  { id: 'software', category: 'software', capability: 'software',
    objective: 'Implement and test a function that parses dates', expected: 'unsupported',
    validation: 'Software authoring handler unavailable' },
  { id: 'document', category: 'document creation', capability: 'document',
    objective: 'Draft a formal business memo with clear recommendations',
    expected: 'unsupported', validation: 'Document writing/export handler unavailable' },
  { id: 'data', category: 'calculation/data analysis', capability: 'math.sum',
    objective: 'Calculate the total for [2, 3, 5]', inputs: { numbers: [2,3,5] },
    expected: 'completed', validation: 'Exact sum, count, and local provider checked' },
  { id: 'planning', category: 'planning/operations', capability: 'operations',
    objective: 'Create a safe weekly project schedule', expected: 'denied',
    validation: 'No general-purpose planner or scheduler is registered' },
  { id: 'novel', category: 'novel/fallback', capability: 'general',
    objective: 'Explain the tradeoffs in an unusual multidisciplinary question',
    expected: 'unsupported', validation: 'No invented general-response fallback' },
]);

const avg = values => values.length ?
  Math.round(values.reduce((a,b) => a+b, 0) / values.length * 1000) / 1000 : null;
function sanitized(result) {
  return {
    status: result?.status ?? 'unexpected_response',
    capability: result?.capability ?? null,
    auditStatus: result?.audit?.status ?? null,
    output: result?.execution?.output ?? null,
    provenance: result?.execution?.provenance ?? null,
    tracking: result?.tracking?.runState ?? null,
  };
}
function verdict(pilot, response) {
  if (pilot.id === 'data') {
    return response.status === 'completed' &&
      response.output?.total === 10 && response.output?.count === 3 &&
      response.provenance?.provider === 'local-node';
  }
  if (pilot.id === 'research') {
    return response.status === 'completed' &&
      response.output?.repository === REPOSITORY &&
      response.output?.url === 'https://github.com/' + REPOSITORY &&
      response.provenance?.provider === 'github' &&
      Number.isSafeInteger(response.output?.stars) &&
      response.output.stars >= 0;
  }
  return response.status === pilot.expected;
}
function simulatedProvider(calls) {
  return async (url, options) => {
    calls.push({ method: options?.method ?? 'GET', path: new URL(url).pathname });
    if (url !== 'https://api.github.com/repos/' + REPOSITORY ||
        options?.method !== 'GET') throw Error('Unexpected provider request');
    return { ok: true, status: 200, json: async () => ({ ...FIXTURE_REPO }) };
  };
}
// A separate disposable project demonstrates real file-backed retry evidence.
async function durableProbe() {
  const directory=await mkdtemp(join(tmpdir(),'pp-benchmark-durable-'));
  try {
    await initializeProject(directory,'PP-0007 disposable persistence probe');
    const host=createReferenceHost({durableProject:directory,
      durableSecret:'host-managed-benchmark-only-secret-00001'});
    const request={id:'8a0dc3bd-e94f-427a-a277-aaabf621047b',
      objective:'Calculate approved project sum',
      capability:'math.sum',inputs:{numbers:[9,11]}};
    const start=performance.now();
    const first=await host.execute(request);
    const retry=await host.execute(request);
    const data=(await loadProject(directory)).state;
    const stored=data.tasks[0];
    return {
      firstStatus:first.status,retryStatus:retry.status,output:first.execution?.output?.total ?? null,
      persistedTaskCount:data.tasks.length,storedRunState:stored?.gatewayRun ?? null,
      elapsedMs:Math.round(Math.max(0,performance.now()-start)*1000)/1000,
      valid:first.status==='completed' && retry.status==='already_executed' &&
        first.execution?.output?.total===20 && data.tasks.length===1 &&
        stored?.gatewayRun==='completed',
      scope:"Isolated temporary project; directory deleted after proof. Not a production user's task ledger."
    };
  } finally {await rm(directory,{recursive:true,force:true});}
}

/**
 * Measured against fixed expected outcomes, NOT an AI answering baseline.
 * Each case runs once; host-only timings exclude process startup, provider
 * simulation cannot validate the state of the live external service.
 */
export async function runBenchmark({ liveResearch = false, fetchImpl } = {}) {
  const calls=[];
  const researchClient = fetchImpl ?? (liveResearch ?
    async (url, options) => {
      calls.push({ method: options?.method ?? 'GET', path: new URL(url).pathname });
      return globalThis.fetch(url, options);
    } : simulatedProvider(calls));
  const host=createReferenceHost({
    githubResearch:true, allowedRepositories:[REPOSITORY],
    fetchImpl:researchClient, token:undefined, auditMode:'off',
  });
  const pilots=[];
  for(const test of CASES) {
    const before=calls.length, start=performance.now();
    const raw=await host.execute({ objective:test.objective,
      capability:test.capability, ...(test.inputs ? { inputs:test.inputs } : {}) });
    const elapsedMs=Math.max(0,performance.now()-start);
    const output=sanitized(raw),quality=verdict(test,output);
    const providerCalls=calls.length-before;
    pilots.push({
      id:test.id,category:test.category,requestedCapability:test.capability,
      status:output.status,expectedStatus:test.expected,
      requirementMet:output.status==='completed' && quality,
      safeFailure:output.status===test.expected && quality && output.status!=='completed',
      validationPassed:quality,provenanceProvider:output.provenance?.provider ?? null,
      auditStatus:output.auditStatus,providerCalls,elapsedMs:Math.round(elapsedMs*1000)/1000,
      outputSummary:test.id==='data' ? { total:output.output?.total,count:output.output?.count } :
        test.id==='research' ? { repository:output.output?.repository,url:output.output?.url } : null,
      persistedTask:false, correctionInteractionsObserved:0,notes:test.validation,
    });
  }
  // Deliberate fail-closed checks are real host invocations, not projections.
  const badRepo=await host.execute({objective:'Research unauthorized repository',
    capability:'research',inputs:{repository:'attacker/unapproved'}});
  const missingTool=await host.execute({objective:'Compile an arbitrary new executable',
    capability:'software'});
  const unauthorizedWrite=await host.execute({objective:'Create public GitHub issue',
    capability:'operations',inputs:{
      action:'github.create_issue', repository:REPOSITORY, title:'Do not publish',
    }});
  let fakeAuditConfigRejected=false;
  try {
    createReferenceHost({ auditMode:'required',auditRepository:'Papa3445/Pro-Papa-Audit',
      auditTransport:'native',auditFetchImpl:async()=>({ok:true}),
    });
  } catch { fakeAuditConfigRejected=true; }
  const negatives=[
    { id:'unapproved_repository',status:badRepo.status,
      passed:badRepo.status==='provider_unavailable' },
    { id:'unavailable_software_tool',status:missingTool.status,
      passed:missingTool.status==='unsupported' },
    { id:'unauthorized_issue',status:unauthorizedWrite.status,
      passed:unauthorizedWrite.status==='unsupported' || unauthorizedWrite.status==='denied' },
    { id:'fake_audit_transport',status:fakeAuditConfigRejected?'rejected':'accepted',
      passed:fakeAuditConfigRejected },
  ];
  const completed=pilots.filter(p=>p.requirementMet).length;
  const safe=pilots.filter(p=>p.safeFailure).length;
  const durable=await durableProbe();
  const noUnsafe=negatives.every(x=>x.passed)&&pilots.every(x=>x.validationPassed)&&durable.valid;
  return {
    schemaVersion:1,taskId:'PP-0007',kind:'reproducible-bounded-host-pilot',
    mode:liveResearch?'live_read_only_github':'deterministic_fake_github',
    target:'PP-0006 reference host explicitly invoked (not ChatGPT message interception)',
    pilotCount:pilots.length,successfulUserTasks:completed,safelyUnsupported:safe,
    userTaskCompletionRate:Math.round(completed/pilots.length*1000)/1000,
    testExpectationPassRate:Math.round(pilots.filter(p=>p.validationPassed).length/pilots.length*1000)/1000,
    medianHostTimeMs:(()=>{const z=pilots.map(p=>p.elapsedMs).sort((a,b)=>a-b);
      return z[Math.floor(z.length/2)]})(),
    meanHostTimeMs:avg(pilots.map(p=>p.elapsedMs)),
    totalGitHubCallsObserved:calls.length,
    requestsToUnapprovedEndpoints:calls.filter(c=>c.path !== '/repos/'+REPOSITORY).length,
    correctiveInteractionsMeasured:false,
    actualUserCorrections:'not_observed_in_single_pass_automated_fixtures',
    tokenUsage:null, directAssistantBaseline:null,
    baselineReason:'No comparable direct LLM/assistant invocation or token metering in this Node host or CI runner. Deterministic host fixture timings cannot establish superiority over a direct assistant.',
    persistedTaskCount:durable.persistedTaskCount,durableProbe:durable,receiptCount:0,
    receiptExplanation:'auditMode off in these fixtures; PP-0006 positive private receipt is separately provider-verified and not claimed to have been issued for each pilot.',
    validationLimits:'Research validates one provider record (or a deterministic mock), not multiple independent sources; software/document/planning/quick Q&A/fallback are genuinely unsupported.',
    pilots,negatives,guardrailsPassed:noUnsafe,
  };
}
async function main() {
  const liveResearch=process.argv.includes('--live-research');
  if(process.argv.slice(2).some(a=>a!=='--live-research'))throw Error('Unknown benchmark argument');
  const report=await runBenchmark({liveResearch});
  console.log(JSON.stringify(report,null,2));
  if(!report.guardrailsPassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(()=>{console.log(JSON.stringify({status:'benchmark_failed'}));process.exitCode=1;});
}
