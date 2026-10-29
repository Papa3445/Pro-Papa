import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pp0007LedgerSnapshot,pp0009RegistrationSnapshot} from './pp0008-historical-pin-helper.mjs';

const root=new URL('../',import.meta.url);
const read=x=>readFileSync(new URL(x,root));
const j=pp0009RegistrationSnapshot(JSON.parse(read('.pro-papa/tasks.json')));
const work=j.tasks.find(x=>x.id==='PP-0009');
const sha256=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');

test('PP-0009 rev84 is byte-for-byte actual CLI-produced active registration, not closure',()=>{
  const ledger=Buffer.from(JSON.stringify(j,null,2)+'\n');
  assert.equal(blob(ledger),'a7524aed0d6ee7567eb669d5c3833ad04add0b7b');
  assert.equal(sha256(ledger),'936cd4e7272c27c0e682737579f2ad06d96e53db4e41414176814b8390481428');
  assert.equal(j.revision,84);
  assert.equal(work.status,'in_progress');
  assert.equal(work.evidence.length,4);
  assert.deepEqual(work.evidence.map(x=>x.kind),['artifact','test','validation','review']);
  for(const record of work.evidence){
    const bytes=read(record.path);
    assert.equal(sha256(bytes),record.sha256,record.path);
    assert.equal(record.result,'pass');
  }
  assert.equal(work.evidence.at(-1).actor,'papa4568');
  assert.equal(work.reviewTarget.pullRequest,59);
  assert.equal(j.tasks.find(x=>x.id==='PP-0007').evidence.length,85);
  assert.equal(j.tasks.find(x=>x.id==='PP-0008').status,'verified');
  assert.ok(j.tasks.filter(x=>Number(x.id.slice(3))>=10).every(x=>x.status==='pending'));
  assert.equal(pp0007LedgerSnapshot(j).isSuccessor,true);
});

test('PP-0009 exact historical normalization fails closed on proof or unrelated state mutation',()=>{
  const e=structuredClone(j);
  e.tasks.find(x=>x.id==='PP-0009').evidence[0].sha256='0'.repeat(64);
  assert.throws(()=>pp0007LedgerSnapshot(e),/Unknown PP-0009 evidence registration/);
  const tampered=structuredClone(j);
  tampered.tasks.find(x=>x.id==='PP-0010').status='in_progress';
  assert.throws(()=>pp0007LedgerSnapshot(tampered),/historical protected ledger/);
  const fake=structuredClone(j);
  fake.tasks.find(x=>x.id==='PP-0009').status='verified';
  assert.throws(()=>pp0007LedgerSnapshot(fake),/Unknown PP-0009 evidence registration/);
});
