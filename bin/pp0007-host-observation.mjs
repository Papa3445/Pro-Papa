#!/usr/bin/env node
// PP-0007: one original fixture request run through the actual bounded host.
// Output is ungraded and belongs outside the public repository.
import { createReferenceHost } from '../src/reference-host.mjs';
import { canonicalTrial } from './pp0007-api-baseline.mjs';
import { open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const REPO='Papa3445/Pro-Papa';
const RESEARCH_URL='https://api.github.com/repos/'+REPO;
const fail=()=>{throw Error('Invalid PP-0007 host observation invocation')};

/**
 * Execute the unchanged underlying objective and inputs once. The host's
 * grant/handler availability is not altered to make the freeform cases pass.
 * Native mode never accepts injected transport; simulation is never evidence.
 */
export async function runHostOne({id,githubRead=false,mode='native',fetchImpl}={}){
  if(typeof githubRead!=='boolean'|| !['native','simulation'].includes(mode)||
     (mode==='native'&&fetchImpl!==undefined)||
     (mode==='simulation'&&typeof fetchImpl!=='function'))fail();
  const trial=await canonicalTrial(id);
  if(githubRead&&id!=='research')fail();
  if(typeof trial.canonicalCapability!=='string'||trial.canonicalCapability.length>64)fail();
  const observedCalls=[];
  const transport=(url,options)=>{
    if(!githubRead||url!==RESEARCH_URL||options?.method!=='GET')fail();
    observedCalls.push({method:'GET',path:'/repos/'+REPO});
    return (mode==='native'?globalThis.fetch:fetchImpl)(url,options);
  };
  // No GitHub POST, no token, no audit issuer, and no durable task mutation.
  const host=createReferenceHost({
    githubResearch:githubRead,allowedRepositories:githubRead?[REPO]:[],
    token:'',auditMode:'off',fetchImpl:transport,
  });
  const request={
    objective:trial.canonicalObjective,capability:trial.canonicalCapability,
    ...(trial.canonicalInputs===null?{}:{inputs:trial.canonicalInputs}),
  };
  const started=performance.now();
  let result;
  try {result=await host.execute(request);}
  catch {result={status:'outcome_ambiguous',execution:null,audit:{status:'not_requested'}};}
  const elapsedMs=Math.round(Math.max(0,performance.now()-started)*1000)/1000;
  return {
    schemaVersion:1,taskId:'PP-0007',kind:'ungraded-single-case-reference-host',
    id:trial.id,category:trial.category,
    objectiveSha256:trial.objectiveSha256,inputsSha256:trial.inputsSha256,
    fixtureGitBlobSha:trial.fixtureGitBlobSha,
    requestedCapability:trial.canonicalCapability,
    transport:mode==='native'?'native_reference_host':'simulated_reference_host_transport',
    authenticity:mode==='native'?'local_host_execution_not_independent_quality_grade':
      'simulation_only_no_provider_evidence',
    githubReadAuthorized:githubRead,
    githubTransportAttemptsObserved:observedCalls.length,
    githubNetworkRequestsIndependentlyConfirmed:null,
    resultStatus:result.status??'outcome_ambiguous',
    actualCapability:result.capability??null,
    execution:result.execution??null,
    auditStatus:result.audit?.status??'not_requested',
    trackingMode:result.tracking?.mode??'ephemeral',
    persistenceObserved:false,privateUsageReceipt:null,
    latencyMs:elapsedMs,providerReportedTokens:null,
    taskSuccess:null,qualityGrade:null,correctionInteractions:null,
    toolPermissionsComparableToApiBaseline:githubRead?false:null,
    limitations:'One fixed original request. No automatic retries, output-quality grade, audited receipt or direct-assistant superiority claim.',
  };
}

function parse(args){
  const values={},known=new Set(['--execute','--case','--out','--github-read']);
  const flags=new Set(['--execute','--github-read']);
  for(let i=0;i<args.length;i++){
    const key=args[i];
    if(!known.has(key)||Object.hasOwn(values,key))fail();
    if(flags.has(key))values[key]=true;
    else {const value=args[++i];if(!value||value.startsWith('--'))fail();values[key]=value;}
  }
  if(values['--execute']!==true||!isAbsolute(values['--out']??'')||
     !['qa','research','software','document','data','planning','novel'].includes(values['--case'])||
     (values['--github-read']&&values['--case']!=='research'))fail();
  return values;
}

export async function main(argv=process.argv.slice(2),log=console.log){
  const args=parse(argv),destination=resolve(args['--out']);
  const [parent,framework]=await Promise.all([realpath(dirname(destination)),realpath(ROOT)]);
  if(parent===framework||parent.startsWith(framework+sep))fail();
  // Reserve the private destination before any external read. Never overwrite.
  const file=await open(destination,'wx',0o600);
  try {
    const result=await runHostOne({
      id:args['--case'],githubRead:args['--github-read']===true,
    });
    await file.writeFile(JSON.stringify(result,null,2)+'\n');
    await file.sync();
    log(JSON.stringify({status:'host_observation_saved',caseId:result.id,
      resultStatus:result.resultStatus,taskSuccess:null,
      transport:result.transport}));
    if(result.resultStatus!=='completed')process.exitCode=1;
    return result;
  }finally{await file.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(()=>{console.log(JSON.stringify({status:'host_observation_not_recorded'}));
    process.exitCode=1;});
}
