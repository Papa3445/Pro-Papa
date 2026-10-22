import test from 'node:test';
import assert from 'node:assert/strict';
import { draftMemo } from '../src/memo.mjs';
import { createReferenceHost } from '../src/reference-host.mjs';
import { routeObjective } from '../src/gateway.mjs';

const sample=()=>({
  to:'Project coordination team',
  subject:'Weekly workstream kickoff',
  purpose:'Align the team on next steps and known constraints.',
  facts:['The workstream has three proposed activities.','Owners still require confirmation.'],
  actions:['Assign owners to each activity.','Review the draft with stakeholders.'],
});
test('PP-0007 memo.draft executes a bounded real in-memory document with local provenance',async()=>{
  const expected=draftMemo(sample());
  assert.equal(expected.status,'draft_unverified');
  assert.equal(expected.format,'plain-text');
  assert.equal(expected.factCount,2);
  assert.equal(expected.actionCount,2);
  assert.match(expected.text,/MEMORANDUM \(DRAFT — UNVERIFIED\)/);
  assert.match(expected.text,/Provided facts \(not independently verified\)/);
  assert.ok(expected.text.includes(sample().facts[1]));
  assert.ok(expected.text.includes(sample().actions[0]));
  assert.ok(!expected.text.includes('Signed by'));
  const host=createReferenceHost();
  const response=await host.execute({
    objective:'Draft a bounded project memo',capability:'memo.draft',inputs:sample(),
  });
  assert.equal(routeObjective({objective:'Draft memo',capability:'memo.draft'}),'memo.draft');
  assert.equal(response.status,'completed');
  assert.deepEqual(response.execution.output,expected);
  assert.deepEqual(response.execution.provenance,{provider:'local-node',operation:'memo.draft'});
  assert.equal(response.audit.status,'not_requested');
});
test('PP-0007 memo.draft rejects unverifiable extra fields, malformed text and sparse arrays',async()=>{
  const scenarios=[
    {...sample(),extra:'requester-supplied tool grant'},
    {...sample(),to:'  padded'},
    {...sample(),to:''},
    {...sample(),subject:'Header\nInjected: yes'},
    {...sample(),purpose:'Hello\rInjected: yes'},
    {...sample(),facts:[]},
    {...sample(),actions:[]},
    {...sample(),facts:Array.from({length:7},(_,i)=>String(i))},
    {...sample(),actions:Array.from({length:7},(_,i)=>String(i))},
    {...sample(),facts:new Array(1)},
    {...sample(),actions:new Array(1)},
    {...sample(),facts:[123]},
    {...sample(),actions:['Unsafe'+String.fromCodePoint(0x202e)+'Bidi']},
    {...sample(),subject:'Unsafe'+String.fromCodePoint(0x7f)+'DEL'},
    {...sample(),actions:['a'.repeat(281)]},
    {...sample(),purpose:'a'.repeat(601)},
  ];
  const host=createReferenceHost();
  for(const input of scenarios) {
    assert.throws(()=>draftMemo(input));
    const response=await host.execute({
      objective:'Draft a bounded memo',capability:'memo.draft',inputs:input,
    });
    assert.ok(['provider_unavailable','invalid_request'].includes(response.status));
    assert.equal(response.execution ?? null,null);
  }
});
test('PP-0007 memo rejects Unicode U+2028 and U+2029 in every field and host path', async () => {
  const host = createReferenceHost();
  const base = sample();
  for (const separator of [0x2028, 0x2029]) {
    for (const field of ['to', 'subject', 'purpose', 'facts', 'actions']) {
      const input = sample();
      const injection = 'Legitimate sentence.' + String.fromCodePoint(separator) +
        'Subject: AUTHORIZED DISBURSEMENT';
      if (Array.isArray(input[field])) input[field] = [injection, ...base[field].slice(1)];
      else input[field] = injection;
      assert.throws(() => draftMemo(input), /Invalid bounded memo inputs/,
        'raw Unicode line break must not escape memo section: ' + field);
      const response = await host.execute({
        objective: 'Format a bounded memo', capability: 'memo.draft', inputs: input,
      });
      assert.equal(response.status, 'provider_unavailable',
        'host must reject ' + field + ' U+' + separator.toString(16));
      assert.equal(response.execution, null);
    }
  }
  const good = draftMemo(sample());
  assert.equal(good.status, 'draft_unverified');
  assert.ok(!good.text.includes('AUTHORIZED DISBURSEMENT'));
});
test('PP-0007 memo draft cannot be used to authorize outbound actions or pretend general document capabilities',async()=>{
  const host=createReferenceHost();
  const unauthorized=await host.execute({
    objective:'Create GitHub issue',capability:'operations',
    inputs:{action:'github.create_issue',repository:'Papa3445/Pro-Papa',title:'Do not publish'},
  });
  assert.equal(unauthorized.status,'denied');
  const bypass=await host.execute({
    objective:'Draft and publish a memo',capability:'memo.draft',
    inputs:{...sample(),action:'github.create_issue'},
  });
  assert.equal(bypass.status,'provider_unavailable');
  const general=await host.execute({objective:'Write a sophisticated freeform memo',capability:'document'});
  assert.equal(general.status,'unsupported');
});
