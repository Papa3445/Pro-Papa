import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalTrial, runOne, main } from '../bin/pp0007-api-baseline.mjs';

const fixed = () => ({
  id:'resp_abcdef12345',object:'response',status:'completed',model:'gpt-test',
  output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Paris'}]}],
  usage:{input_tokens:12,output_tokens:2,total_tokens:14},
});
const service=(reply=fixed())=>{
  const calls=[];
  return {calls, fetchImpl: async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,text:async()=>JSON.stringify(reply)};
  }};
};
const simulate=(f,id='qa')=>runOne({id,model:'gpt-test',apiKey:'fixture-secret-value',
  mode:'simulation',fetchImpl:f.fetchImpl});

test('frozen seven original cases are pinned to independently reviewed fixture',async()=>{
  const qa=await canonicalTrial('qa');
  assert.equal(qa.prompt,'What is the capital city of France?');
  assert.equal(qa.fixtureGitBlobSha,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
  const research=await canonicalTrial('research');
  assert.equal(research.prompt,'Research repository metadata with a provider URL\nCanonical inputs (JSON): {"repository":"Papa3445/Pro-Papa"}');
  const raw=await readFile(new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url));
  const corrupted=Buffer.from(raw);corrupted[10]=corrupted[10]===65?66:65;
  await assert.rejects(canonicalTrial('qa',corrupted),/Invalid PP-0007/);
  await assert.rejects(canonicalTrial('unknown'),/Invalid PP-0007/);
});

test('simulated single request uses fixed HTTPS endpoint, no tools, no storage and no token exposure',async()=>{
  const f=service(),value=await simulate(f);
  assert.equal(value.responseStatus,'completed');
  assert.equal(value.transport,'simulated_transport');
  assert.equal(value.authenticity,'simulation_only_no_provider_evidence');
  assert.equal(value.providerResponseId,'resp_abcdef12345');
  assert.equal(value.text,'Paris');
  assert.deepEqual(value.usage,{inputTokens:12,outputTokens:2,totalTokens:14});
  assert.equal(value.qualityGrade,null);
  assert.equal(value.taskSuccess,null);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].url,'https://api.openai.com/v1/responses');
  const request=JSON.parse(f.calls[0].options.body);
  assert.equal(request.store,false);
  assert.deepEqual(request.tools,[]);
  assert.equal(request.max_output_tokens,2048);
  assert.equal(request.input[0].content[0].text,'What is the capital city of France?');
  assert.equal(f.calls[0].options.redirect,'error');
  assert.equal(f.calls[0].options.headers.Authorization,'Bearer fixture-secret-value');
  assert.ok(!JSON.stringify(value).includes('fixture-secret-value'));
});

test('all simulated cases retain frozen prompt identity without claiming result quality',async()=>{
  const ids=['qa','research','software','document','data','planning','novel'];
  for(const id of ids){const f=service();const v=await simulate(f,id);
    assert.equal(v.id,id);assert.equal(v.taskSuccess,null);
    assert.match(v.objectiveSha256,/^[a-f0-9]{64}$/);
    assert.match(v.inputsSha256,/^[a-f0-9]{64}$/);
    assert.equal(f.calls.length,1);
  }
});

test('no injected transport may masquerade as native production execution',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return {ok:true}};
  await assert.rejects(runOne({id:'qa',model:'gpt-test',apiKey:'fake-key-001',
    fetchImpl}),/Invalid PP-0007/);
  await assert.rejects(runOne({id:'qa',model:'gpt-test',apiKey:'fake-key-001',
    mode:'simulation'}),/Invalid PP-0007/);
  await assert.rejects(runOne({id:'qa',model:'https://host',apiKey:'fake-key-001',
    mode:'simulation',fetchImpl}),/Invalid PP-0007/);
  await assert.rejects(runOne({id:'qa',model:'gpt-test',apiKey:'bad\nsecret-001',
    mode:'simulation',fetchImpl}),/Invalid PP-0007/);
  assert.equal(calls,0);
});

test('provider HTTP failure and network exception remain ambiguous with no retry',async()=>{
  for(const fetchImpl of [async()=>({ok:false,status:403,text:async()=>'{"error":"private"}'}),
    async()=>{throw Error('credential-private-do-not-log')}]) {
    let calls=0;
    const x=await runOne({id:'qa',model:'gpt-test',apiKey:'fixture-secret-value',
      mode:'simulation',fetchImpl:async(...a)=>{calls++;return fetchImpl(...a)}});
    assert.equal(calls,1);assert.equal(x.responseStatus,'outcome_ambiguous');
    assert.equal(x.providerResponseId,null);assert.equal(x.text,null);
    assert.ok(!JSON.stringify(x).includes('credential-private-do-not-log'));
  }
});

test('fake provider token accounting, status or tool-call output cannot count as success',async()=>{
  const variations=[
    x=>{x.status='incomplete'},x=>{x.object='chat.completion'},
    x=>{x.id='forged'},x=>{x.model='unexpected-model'},x=>{x.usage.total_tokens=-1},
    x=>{x.usage.total_tokens=1},
    x=>{x.output[0].type='function_call'},
    x=>{x.output[0].content[0].text=''},
    x=>{x.output[0].content[0].type='input_text'},
    x=>{x.output[0].role='tool'},
  ];
  for(const change of variations){const r=fixed();change(r);
    const v=await simulate(service(r));
    assert.equal(v.responseStatus,'outcome_ambiguous');assert.equal(v.taskSuccess,null);
  }
});

test('model refusal remains refusal, never completed answer',async()=>{
  const r=fixed();r.output[0].content=[{type:'refusal',refusal:'I cannot do that'}];
  const v=await simulate(service(r));
  assert.equal(v.responseStatus,'refused');assert.equal(v.text,null);
  assert.equal(v.taskSuccess,null);
});

test('CLI requires affirmative execution, private absolute output and host-managed key before HTTP',async()=>{
  for(const args of [[],['--case','qa','--model','gpt-test','--out','/tmp/x.json'],
    ['--execute','--case','qa','--model','gpt-test','--out','relative.json'],
    ['--execute','--case','evil','--model','gpt-test','--out','/tmp/x.json'],
    ['--execute','--case','qa','--model','gpt-test','--out','/tmp/x.json','--tools','all']]){
    await assert.rejects(main(args,{OPENAI_API_KEY:'fixture-secret-value'},()=>{}),/Invalid PP-0007/);
  }
  await assert.rejects(main(['--execute','--case','qa','--model','gpt-test','--out','/tmp/x.json'],{},()=>{}),/Invalid PP-0007/);
});
