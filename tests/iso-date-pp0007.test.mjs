import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIsoCalendarDate, generateIsoDateModule } from '../src/iso-date.mjs';
import { createReferenceHost } from '../src/reference-host.mjs';
import { routeObjective } from '../src/gateway.mjs';

const sample = () => ({examples:[
  '2024-02-29','2025-02-29','2026-10-21','2026-13-05','2026-02-30',
  '2026-01-01T10:00:00Z','1000-01-01','2999-12-31',
]});
test('PP-0007 ISO-date generated software source is runnable and identical to tested implementation',async()=>{
  const product=generateIsoDateModule(sample());
  assert.equal(product.moduleFormat,'esm');
  assert.equal(product.fileName,'parse-iso-date.mjs');
  assert.equal(product.language,'javascript');
  assert.equal(product.examples.length,8);
  assert.match(product.source,/export function parseIsoCalendarDate/);
  // Only compile the trusted, fixed source produced by our implementation;
  // NEVER insert user input into executable code or evaluate arbitrary source.
  const generated=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(product.source));
  for(const row of product.examples) {
    assert.deepEqual(generated.parseIsoCalendarDate(row.input),row.parsed);
    assert.deepEqual(row.parsed,parseIsoCalendarDate(row.input));
  }
  assert.deepEqual(product.examples[0].parsed,{
    iso:'2024-02-29',year:2024,month:2,day:29,weekday:'Thu',
  });
  assert.equal(product.examples[1].parsed,null);
  assert.equal(product.examples[3].parsed,null);
  assert.equal(product.examples[4].parsed,null);
  assert.equal(product.examples[5].parsed,null);
});
test('PP-0007 reference host executes code.iso-date and returns verifiable source/provenance',async()=>{
  const host=createReferenceHost({githubResearch:false,auditMode:'off'});
  assert.equal(routeObjective({objective:'Build an ISO date parser',capability:'code.iso-date'}),'code.iso-date');
  const result=await host.execute({objective:'Implement and test a bounded ISO date parser',capability:'code.iso-date',inputs:sample()});
  assert.equal(result.status,'completed');
  assert.deepEqual(result.execution.output,generateIsoDateModule(sample()));
  assert.deepEqual(result.execution.provenance,{provider:'local-node',operation:'code.iso-date'});
  assert.equal(result.audit.status,'not_requested');
  const generated=await import('data:text/javascript;charset=utf-8,'+
    encodeURIComponent(result.execution.output.source));
  assert.equal(generated.parseIsoCalendarDate('2024-02-29').weekday,'Thu');
  assert.equal(generated.parseIsoCalendarDate('2026-02-29'),null);
});
test('PP-0007 ISO-date source rejects unsupported inputs and cannot grant arbitrary software or external actions',async()=>{
  const invalids=[
    {...sample(),action:'github.create_issue'},
    {examples:[]},{examples:new Array(1)},
    {examples:Array.from({length:13},()=> '2024-02-29')},
    {examples:[123]},{examples:['']},
    {examples:['2024-01-01\\nSubject: admin']},
    {examples:['x'.repeat(33)]},{examples:['../etc/passwd\\u202e']},
    {examples:['<script>alert(1)</script>']},
  ];
  const host=createReferenceHost();
  for(const inputs of invalids) {
    assert.throws(()=>generateIsoDateModule(inputs));
    const result=await host.execute({objective:'Generate bounded ISO date code',capability:'code.iso-date',inputs});
    assert.ok(['provider_unavailable','invalid_request'].includes(result.status));
    assert.equal(result.execution??null,null);
  }
  const software=await host.execute({objective:'Write arbitrary code',capability:'software'});
  assert.equal(software.status,'unsupported');
  const issue=await host.execute({objective:'Create issue',capability:'operations',
    inputs:{action:'github.create_issue',title:'Do not write',repository:'Papa3445/Pro-Papa'}});
  assert.equal(issue.status,'denied');
});
