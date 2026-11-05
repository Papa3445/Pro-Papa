import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {profileNumericData} from '../src/data-profile.mjs';
import {createReferenceHost} from '../src/reference-host.mjs';
import {GATEWAY_CAPABILITIES,routeObjective} from '../src/gateway.mjs';

const request=(values,extra={})=>({objective:'Summarize these numeric observations',
  capability:'data.profile',inputs:{values},...extra});
const cli=fileURLToPath(new URL('../bin/reference-host.mjs',import.meta.url));
const call=(flags,input)=>spawnSync(process.execPath,[cli,...flags],{
  encoding:'utf8',input:JSON.stringify(input),
  env:{...process.env,GITHUB_TOKEN:'',PRO_PAPA_AUDIT_REPO:''},
});

test('PP-0011 numeric profile computes bounded real results but never returns raw inputs',()=>{
  const result=profileNumericData({values:[2,null,3,5]});
  assert.equal(result.numericCount,3);
  assert.equal(result.missingCount,1);
  assert.equal(result.sum,10);
  assert.equal(result.mean,10/3);
  assert.equal(result.median,3);
  assert.equal(result.min,2);
  assert.equal(result.max,5);
  assert.equal(Object.hasOwn(result,'values'),false);
  assert.equal(profileNumericData({values:[5,1,2,3]}).median,2.5);
});
test('PP-0011 invalid numbers, sparse arrays, extra fields and accessors fail closed',()=>{
  const sparse=[1,,2];
  let getters=0;
  const accessor={};
  Object.defineProperty(accessor,'values',{enumerable:true,get(){getters++;return [1]}});
  for(const input of [
    null,[],{}, {values:[]}, {values:[null]}, {values:[NaN]},
    {values:[Infinity]}, {values:[-Infinity]}, {values:[-0]},
    {values:['2']}, {values:[true]}, {values:[[3]]},
    {values:[1000000001]}, {values:sparse},
    {values:[1],allowWrites:true}, {values:Array(101).fill(1)}, accessor,
  ]) assert.throws(()=>profileNumericData(input),/Invalid bounded data-profile inputs/);
  assert.equal(getters,0,'Accessors never evaluated');
});
test('PP-0011 request content does not grant profiling; trusted host setting does',async()=>{
  assert.equal(GATEWAY_CAPABILITIES['data.profile'].effect,'read');
  assert.equal(routeObjective(request([2,3])),'data.profile');
  assert.throws(()=>createReferenceHost({dataProfileEnabled:'true'}),/Unverified host configuration/);
  const denied=await createReferenceHost().execute(request([2,3],{
    dataProfileEnabled:true,grants:['data.profile'],enabled:true,
  }));
  assert.equal(denied.status,'denied');
  assert.equal(denied.reason,'host_permission_required');
  const allowed=await createReferenceHost({dataProfileEnabled:true}).execute(request([2,null,3,5]));
  assert.equal(allowed.status,'completed');
  assert.deepEqual(allowed.execution.provenance,
    {provider:'local-node',operation:'data.profile'});
  assert.equal(allowed.execution.output.sum,10);
  assert.equal(allowed.execution.output.missingCount,1);
  assert.equal(allowed.audit.status,'not_requested');
});
test('PP-0011 standalone CLI respects explicit opt-in and suppresses invalid raw values',()=>{
  const denied=call([],request([4,6]));
  assert.equal(denied.status,1);
  assert.equal(JSON.parse(denied.stdout).status,'denied');
  assert.equal(denied.stderr,'');
  const accepted=call(['--data-profile'],request([4,null,6]));
  assert.equal(accepted.status,0);
  const result=JSON.parse(accepted.stdout);
  assert.equal(result.status,'completed');
  assert.equal(result.execution.output.mean,5);
  assert.equal(result.execution.output.missingCount,1);
  assert.equal(result.tracking.mode,'ephemeral');
  assert.equal(accepted.stderr,'');
  const bad=call(['--data-profile'],request(['UNSAFE_RAW_INPUT']));
  assert.equal(bad.status,1);
  assert.notEqual(JSON.parse(bad.stdout).status,'completed');
  assert.equal(bad.stdout.includes('UNSAFE_RAW_INPUT'),false);
  assert.equal(bad.stderr,'');
});
test('PP-0011 local cross-domain smoke checks actual deterministic outputs and denied effects',async()=>{
  const host=createReferenceHost({dataProfileEnabled:true});
  const cases=[
    {type:'data',request:request([2,3,5]),
      verify:x=>x.sum===10&&x.median===3},
    {type:'document',request:{objective:'Draft internal note',capability:'memo.draft',
      inputs:{to:'Team',subject:'Weekly review',purpose:'Assess progress.',
        facts:['Three completed tasks'],actions:['Review remaining work']}},
      verify:x=>x.status==='draft_unverified'&&x.text.includes('Three completed tasks')},
    {type:'planning',request:{objective:'Plan Monday tasks',capability:'plan.week',
      inputs:{weekOf:'2026-11-02',tasks:[{id:'review',title:'Review source'}]}},
      verify:x=>x.scheduledCount===1&&x.entries[0].date==='2026-11-02'},
    {type:'software',request:{objective:'Generate safe parser source',capability:'code.iso-date',
      inputs:{examples:['2026-11-04','2026-02-30']}},
      verify:x=>x.language==='javascript'&&x.examples[0].parsed.day===4&&
        x.examples[1].parsed===null},
  ];
  for(const {type,request:input,verify} of cases){
    const response=await host.execute(input);
    assert.equal(response.status,'completed',type);
    assert.equal(verify(response.execution.output),true,type);
    assert.equal(response.execution.provenance.provider,'local-node');
  }
  const deniedResearch=await host.execute({objective:'Read public repository metadata',
    capability:'research',inputs:{repository:'Papa3445/Pro-Papa'}});
  assert.equal(deniedResearch.status,'denied');
  const deniedEffects=await host.execute({objective:'Create arbitrary external issue',
    capability:'operations',inputs:{action:'github.create_issue'}});
  assert.equal(deniedEffects.status,'denied');
  // Local handler outcomes are not live GitHub GETs, native ChatGPT completions
  // or independent user acceptance of document/planning/software quality.
});
