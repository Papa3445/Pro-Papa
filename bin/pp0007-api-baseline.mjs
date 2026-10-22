#!/usr/bin/env node
// PP-0007: explicit, one-case-at-a-time, text-only model API observation.
// Does not grade task quality or constitute a ChatGPT UI baseline.
import { createHash } from 'node:crypto';
import { open, realpath, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE = new URL('../fixtures/pp0007-paired-trial-collection-template.json', import.meta.url);
// Git blob from independently approved/merged PR #15. Updating fixtures needs review.
const FIXTURE_BLOB = 'aa07d8296ab8c4ad492ec02863bd4203bb90ead4';
const CASE_IDS = ['qa','research','software','document','data','planning','novel'];
const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const RESPONSE_ID = /^resp_[a-zA-Z0-9_-]{6,128}$/;
const fail = () => { throw Error('Invalid PP-0007 baseline invocation or observation'); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function canonicalTrial(id, raw = null) {
  raw ??= await readFile(FIXTURE);
  if (!CASE_IDS.includes(id) || !Buffer.isBuffer(raw)) fail();
  const blob = createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
  if (blob !== FIXTURE_BLOB) fail();
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { fail(); }
  if (data.taskId !== 'PP-0007' || data.status !== 'not_collected' ||
      data.kind !== 'prospective-matched-trial-collection-template' ||
      !Array.isArray(data.trials) || data.trials.length !== CASE_IDS.length ||
      data.trials.some((t, i) => t.id !== CASE_IDS[i] ||
        typeof t.canonicalObjective !== 'string' || !t.canonicalObjective.trim() ||
        t.baselineTrial !== null || t.hostTrial !== null)) fail();
  const trial = data.trials.find(x => x.id === id);
  const objective = trial.canonicalObjective;
  const prompt = objective + (trial.canonicalInputs === null ? '' :
    '\nCanonical inputs (JSON): ' + JSON.stringify(trial.canonicalInputs));
  return { id, category: trial.category, prompt,
    canonicalObjective: objective,
    canonicalInputs: trial.canonicalInputs,
    canonicalCapability: trial.canonicalCapability,
    objectiveSha256: digest(Buffer.from(objective)),
    inputsSha256: digest(Buffer.from(JSON.stringify(trial.canonicalInputs))),
    fixtureGitBlobSha: FIXTURE_BLOB };
}

function extract(response) {
  if (!response || response.ok !== true || response.status !== 200) fail();
  return response.text();
}
// API aliases may resolve to a dated snapshot in response.model.
// Only accept an exact identity or a calendar-valid YYYY-MM-DD snapshot of the
// exact requested alias. A different family remains unverified, never success.
function modelIdentity(requested, actual) {
  if (requested === actual) return 'exact';
  if (!actual.startsWith(requested + '-')) return 'unverified';
  const date = actual.slice(requested.length + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'unverified';
  const instant = new Date(date + 'T00:00:00.000Z');
  return Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === date ? 'dated_snapshot' : 'unverified';
}
const LIFECYCLE_STATES = new Set([
  'completed', 'incomplete', 'failed', 'cancelled', 'in_progress', 'queued',
]);

function readOutput(raw, requestedModel) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 1048576) fail();
  const j = JSON.parse(raw);
  if (!j || j.object !== 'response' || !RESPONSE_ID.test(j.id) ||
      !LIFECYCLE_STATES.has(j.status) || typeof j.model !== 'string' ||
      !MODEL.test(j.model) || !Array.isArray(j.output)) fail();

  // Preserve observable provider identity and metering BEFORE determining
  // whether task content or the lifecycle is a valid completed text answer.
  let usage = null;
  if (j.usage != null) {
    const { input_tokens: input, output_tokens: output, total_tokens: total } = j.usage;
    if (![input, output, total].every(x => Number.isSafeInteger(x) && x >= 0) ||
        total < input + output) fail();
    usage = { inputTokens: input, outputTokens: output, totalTokens: total };
  }
  const identity = modelIdentity(requestedModel, j.model);
  const observed = {
    providerResponseId: j.id, actualModel: j.model,
    providerLifecycleStatus: j.status, modelIdentityStatus: identity, usage,
    text: null,
  };
  // Incomplete, failed and cancelled calls may have consumed billed tokens.
  // They are known provider outcomes, not unknown network outcomes. Neither
  // partial output nor a provider ID establishes task completion.
  if (j.status !== 'completed') {
    return { ...observed, responseStatus: j.status };
  }
  if (identity === 'unverified') {
    return { ...observed, responseStatus: 'model_identity_unverified' };
  }

  const contents = [];
  let refusal = false;
  for (const item of j.output) {
    if (item.type === 'reasoning') continue;
    if (item.type !== 'message' || item.role !== 'assistant' ||
        !Array.isArray(item.content)) {
      return { ...observed, responseStatus: 'outcome_ambiguous' };
    }
    for (const part of item.content) {
      if (part.type === 'refusal') { refusal = true; continue; }
      if (part.type !== 'output_text' || typeof part.text !== 'string') {
        return { ...observed, responseStatus: 'outcome_ambiguous' };
      }
      contents.push(part.text);
    }
  }
  const text = contents.join('\n');
  if (!refusal && (!text.trim() || text.length > 65536)) {
    return { ...observed, responseStatus: 'outcome_ambiguous' };
  }
  return { ...observed, responseStatus: refusal ? 'refused' : 'completed',
    text: refusal ? null : text };
}

export async function runOne({ id, model, apiKey, mode = 'native', fetchImpl } = {}) {
  if (typeof model !== 'string' || !MODEL.test(model) || typeof apiKey !== 'string' ||
      apiKey.length < 8 || /[\r\n]/.test(apiKey) ||
      !['native','simulation'].includes(mode) ||
      (mode === 'native' && fetchImpl !== undefined) ||
      (mode === 'simulation' && typeof fetchImpl !== 'function')) fail();
  const trial = await canonicalTrial(id);
  const observation = {
    schemaVersion:1,taskId:'PP-0007',kind:'ungraded-single-case-api-baseline',
    id:trial.id,category:trial.category,requestedModel:model,
    objectiveSha256:trial.objectiveSha256,inputsSha256:trial.inputsSha256,
    fixtureGitBlobSha:trial.fixtureGitBlobSha,
    transport: mode === 'native' ? 'native_openai_responses_api' : 'simulated_transport',
    authenticity:mode === 'native' ? 'native_api_reply_not_independently_attested' :
      'simulation_only_no_provider_evidence',
    providerResponseId:null,actualModel:null,responseStatus:'outcome_ambiguous',
    text:null,usage:null,latencyMs:null,taskSuccess:null,qualityGrade:null,
    correctiveInteractions:null,privateUsageReceipt:null,
  };
  const body={model,input:[{role:'user',content:[{type:'input_text',text:trial.prompt}]}],
    store:false,tools:[],max_output_tokens:2048};
  const start=performance.now();
  try {
    const response=await (mode === 'native' ? globalThis.fetch : fetchImpl)(
      'https://api.openai.com/v1/responses',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),
        headers:{ Authorization:'Bearer '+apiKey,'Content-Type':'application/json' },
        body:JSON.stringify(body),
      });
    const parsed=readOutput(await extract(response),model);
    Object.assign(observation,parsed);
  } catch {
    // Network outcomes may have incurred a charge. Never retry automatically.
    observation.responseStatus='outcome_ambiguous';
  }
  observation.latencyMs=Math.round(Math.max(0,performance.now()-start)*1000)/1000;
  return observation;
}

function options(argv) {
  const keys=new Set(['--execute','--case','--model','--out']);
  const data={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(!keys.has(key)||Object.hasOwn(data,key))fail();
    if(key==='--execute')data[key]=true;
    else {const val=argv[++i];if(!val||val.startsWith('--'))fail();data[key]=val;}
  }
  if(data['--execute']!==true||!CASE_IDS.includes(data['--case'])||
      !MODEL.test(data['--model']??'')||!isAbsolute(data['--out']??''))fail();
  return data;
}
export async function main(argv=process.argv.slice(2),env=process.env,
  log=console.log) {
  const args=options(argv);
  if(typeof env.OPENAI_API_KEY!=='string'||env.OPENAI_API_KEY.length<8)fail();
  const destination=resolve(args['--out']);
  const parent=await realpath(dirname(destination));
  const framework=await realpath(ROOT);
  if(parent===framework||parent.startsWith(framework+sep))fail();
  // Reserve a private new file BEFORE billable network activity; never overwrite.
  const handle=await open(destination,'wx',0o600);
  try {
    const observation=await runOne({id:args['--case'],model:args['--model'],
      apiKey:env.OPENAI_API_KEY});
    await handle.writeFile(JSON.stringify(observation,null,2)+'\n');
    await handle.sync();
    log(JSON.stringify({status:'observation_saved',caseId:observation.id,
      responseStatus:observation.responseStatus,
      taskSuccess:null,transport:observation.transport}));
    if(observation.responseStatus!=='completed')process.exitCode=1;
    return observation;
  } finally {await handle.close();}
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  main().catch(()=>{console.log(JSON.stringify({status:'baseline_not_recorded'}));
    process.exitCode=1;});
}
