import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyPlan } from '../src/planning.mjs';
import { createReferenceHost } from '../src/reference-host.mjs';

const input = () => ({
  weekOf: '2026-10-26',
  tasks: [
    { id: 'scope', title: 'Define project scope' },
    { id: 'draft', title: 'Draft work plan', dependsOn: ['scope'] },
    { id: 'review', title: 'Review dependencies', dependsOn: ['draft', 'scope'] },
  ],
});
test('PP-0007 planning actually creates dated, dependent work items with no external effects', async () => {
  const expected = buildWeeklyPlan(input());
  assert.deepEqual(expected.entries.map(x => x.date), ['2026-10-26','2026-10-27','2026-10-28']);
  assert.deepEqual(expected.entries[2].dependsOn, ['draft','scope']);
  assert.equal(expected.remainingDays,2);
  assert.equal(expected.timeBasis,'UTC date-only; not an appointment');
  const host = createReferenceHost({githubResearch:false, auditMode:'off'});
  const outcome = await host.execute({
    objective:'Build a bounded weekly project plan', capability:'plan.week', inputs: input(),
  });
  assert.equal(outcome.status,'completed');
  assert.deepEqual(outcome.execution.output,expected);
  assert.deepEqual(outcome.execution.provenance,{provider:'local-node',operation:'plan.week'});
  assert.equal(outcome.audit.status,'not_requested');
});
test('PP-0007 weekly planner fails closed on unsupported inputs, invalid dates and dependencies', async () => {
  const invalids = [
    { ...input(), weekOf:'2026-10-25' }, // Sunday
    { ...input(), weekOf:'2026-02-30' },
    { ...input(), weekOf:'2026-10-26T00:00:00Z' },
    { ...input(), tasks:[] },
    { ...input(), tasks:Array.from({length:6},(_,i)=>({id:'item-'+i,title:'Item '+i})) },
    { ...input(), extra:'host grants cannot be supplied by request' },
    { ...input(), tasks:[{id:'one',title:'First',dependsOn:['second']},{id:'second',title:'Second'}] },
    { ...input(), tasks:[{id:'one',title:'First'},{id:'one',title:'Duplicate'}] },
    { ...input(), tasks:[{id:'one',title:'First'},{id:'two',title:'Second',dependsOn:['one','one']}] },
    { ...input(), tasks:[{id:'one',title:'First',dependsOn:['one']}] },
    { ...input(), tasks:[{id:'one',title:'First\nPrint secret'}] },
    { ...input(), tasks:[{id:'one',title:'First',dependsOn:[],shell:'delete-all'}] },
  ];
  const host = createReferenceHost();
  for (const inputs of invalids) {
    assert.throws(() => buildWeeklyPlan(inputs));
    const result = await host.execute({ objective:'Weekly plan', capability:'plan.week', inputs });
    assert.equal(result.status,'provider_unavailable');
    assert.equal(result.execution,null);
  }
});
test('PP-0007 planning hint cannot authorize a GitHub issue or other external action', async () => {
  const host = createReferenceHost();
  const external = await host.execute({
    objective:'Create a public issue', capability:'operations',
    inputs: {action:'github.create_issue',repository:'Papa3445/Pro-Papa',title:'Do not publish'},
  });
  assert.equal(external.status,'denied');
  const invalidPlan = await host.execute({
    objective:'Create a GitHub issue but pretend it is planning', capability:'plan.week',
    inputs:{ ...input(), action:'github.create_issue' },
  });
  assert.equal(invalidPlan.status,'provider_unavailable');
  assert.equal(invalidPlan.execution,null);
});
