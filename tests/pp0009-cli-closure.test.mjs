import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pp0007LedgerSnapshot,pp0009RegistrationSnapshot} from './pp0008-historical-pin-helper.mjs';

const root=new URL('../',import.meta.url);
const bytes=readFileSync(new URL('.pro-papa/tasks.json',root));
const ledger=JSON.parse(bytes);
const sha=(algorithm,b)=>createHash(algorithm).update(b).digest('hex');

test('PP-0009 candidate is the exact authenticated CLI closure artifact, preserving registered proofs',()=>{
  assert.equal(sha('sha256',bytes),'047ed5b46045716a093f2e9511a0fdaa34d10455136bfcec6321a39b98c528ed');
  assert.equal(sha('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\x00'),bytes])),'d0c9c9a728d2618d5fa197802405fab3e81e6287');
  assert.equal(ledger.revision,85);
  const task=ledger.tasks.find(x=>x.id==='PP-0009');
  assert.equal(task.status,'verified');
  assert.equal(task.verifiedAt,'2026-10-29T01:08:28.727Z');
  const registered=Buffer.from(JSON.stringify(pp0009RegistrationSnapshot(ledger),null,2)+'\n');
  assert.equal(sha('sha256',registered),'936cd4e7272c27c0e682737579f2ad06d96e53db4e41414176814b8390481428');
  const result=JSON.parse(readFileSync(new URL('.pro-papa/evidence/PP-0009/cli-closure-result-2026-10-29.json',root)));
  assert.deepEqual(result.required,['artifact','test','validation','review']);
  assert.deepEqual(result.verifiedFiles,task.evidence.map(x=>x.path));
  assert.equal(result.trustedReview.verdict,'PASS');
  assert.equal(result.trustedReview.candidateSha,'b21d44eb77ad6acc1f3a9f72737d9e80286c12f3');
  assert.equal(result.trustedReview.baseSha,'c5c2c485efac1633ba296aa72588ad9a1544b169');
  assert.equal(result.trustedReview.reviewId,5690821914);
  assert.equal(result.trustedReview.reviewer.login,'papa4568');
  assert.ok(ledger.tasks.filter(x=>Number(x.id.slice(3))>=10).every(x=>x.status==='pending'));
  assert.equal(ledger.tasks.find(x=>x.id==='PP-0007').evidence.length,85);
  assert.equal(pp0007LedgerSnapshot(ledger).canonicalBlob,'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
});

test('PP-0009 closure compatibility rejects malformed transitions and unrelated state changes',()=>{
  for(const mutate of [
    j=>{j.tasks.find(x=>x.id==='PP-0009').verifiedAt='invalid';},
    j=>{j.tasks.find(x=>x.id==='PP-0009').status='in_progress';},
    j=>{j.tasks.find(x=>x.id==='PP-0009').evidence[0].sha256='0'.repeat(64);},
    j=>{j.tasks.find(x=>x.id==='PP-0010').status='in_progress';},
    j=>{j.tasks.find(x=>x.id==='PP-0007').evidence.pop();},
  ]){
    const changed=structuredClone(ledger);mutate(changed);
    assert.throws(()=>pp0007LedgerSnapshot(changed),/PP-0009 closure/);
  }
});
