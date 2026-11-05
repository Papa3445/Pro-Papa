// Prove PP-0010's genuinely CLI-produced closed state is exactly pinned,
// without changing any of the earlier historical closure byte identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pp0007LedgerSnapshot,pp0010RegistrationSnapshot} from './pp0008-historical-pin-helper.mjs';
const root=new URL('../',import.meta.url);
const read=x=>readFileSync(new URL(x,root));
const bytes=read('.pro-papa/tasks.json'),ledger=JSON.parse(bytes);
const hash=(algorithm,b)=>createHash(algorithm).update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');
test('PP-0010 exact CLI successor preserves all four checked proofs and historic baselines',()=>{
  assert.equal(blob(bytes),'b2a886e3c26ad35775a38c634a61390b7f2b2a9a');
  assert.equal(ledger.revision,91);
  const task=ledger.tasks.find(x=>x.id==='PP-0010');
  assert.equal(task.status,'verified');
  assert.equal(task.owner,'chatgpt-implementation');
  assert.equal(task.verifiedAt,'2026-11-05T04:03:52.364Z');
  assert.equal(task.requiresTrustedReview,true);
  assert.deepEqual(task.reviewTarget,{repository:'Papa3445/Pro-Papa',pullRequest:66,
    baseRef:'main',baseSha:'3ad46356bb68fb576874ef54f8a182de402561de'});
  assert.deepEqual(task.evidence.map(x=>x.kind),['artifact','test','validation','review']);
  assert.equal(task.evidence.at(-1).actor,'papa4568');
  for(const proof of task.evidence){
    assert.equal(proof.result,'pass');
    assert.equal(hash('sha256',read(proof.path)),proof.sha256,proof.kind);
  }
  assert.equal(task.evidence[0].sha256,'39d44f59403b52f05b1ffe98b7aa1fa93fbfff04aad886157ac64abcd02b89dd');
  const source=JSON.parse(read(task.evidence[0].path));
  assert.equal(source.positive.status,'released');
  assert.equal(source.positive.independentSavedFileHashMatched,true);
  assert.equal(source.positive.independentPypdfTextMatched,true);
  assert.equal(source.negative.status,'not_released');
  assert.equal(source.negative.publisherCalls,0);
  const closure=JSON.parse(read('.pro-papa/evidence/PP-0010/cli-closure-result-2026-11-04.json'));
  assert.deepEqual(closure.required,['artifact','test','validation','review']);
  assert.deepEqual(closure.verifiedFiles,task.evidence.map(x=>x.path));
  assert.equal(closure.trustedReview.verdict,'PASS');
  assert.equal(closure.trustedReview.reviewId,5777534267);
  assert.equal(closure.trustedReview.candidateSha,'34440103e80e3e8b7425f56ce2fd7967933177b4');
  assert.equal(closure.trustedReview.baseSha,'3ad46356bb68fb576874ef54f8a182de402561de');
  assert.equal(closure.trustedReview.reviewer.login,'papa4568');
  const previous=Buffer.from(JSON.stringify(pp0010RegistrationSnapshot(ledger),null,2)+'\n');
  assert.equal(blob(previous),'d0c9c9a728d2618d5fa197802405fab3e81e6287');
  assert.equal(hash('sha256',previous),'047ed5b46045716a093f2e9511a0fdaa34d10455136bfcec6321a39b98c528ed');
  assert.equal(pp0007LedgerSnapshot(ledger).canonicalBlob,'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
  assert.equal(ledger.tasks.find(x=>x.id==='PP-0007').evidence.length,85);
  assert.equal(ledger.tasks.find(x=>x.id==='PP-0009').status,'verified');
  assert.ok(ledger.tasks.filter(x=>['PP-0011','PP-0012','PP-0013'].includes(x.id))
    .every(x=>x.status==='pending'));
});
test('PP-0010 exact successor rejects mutations to evidence, review, closure time and older tasks',()=>{
  for(const change of [
    x=>{x.tasks.find(t=>t.id==='PP-0010').evidence[0].sha256='0'.repeat(64);},
    x=>{x.tasks.find(t=>t.id==='PP-0010').verifiedAt='2001-01-01T00:00:00.000Z';},
    x=>{x.tasks.find(t=>t.id==='PP-0010').reviewTarget.pullRequest=67;},
    x=>{x.tasks.find(t=>t.id==='PP-0009').evidence.pop();},
    x=>{x.tasks.find(t=>t.id==='PP-0011').status='in_progress';},
  ]){
    const tampered=structuredClone(ledger);
    change(tampered);
    assert.throws(()=>pp0010RegistrationSnapshot(tampered),/Unknown PP-0010 closure/);
    assert.throws(()=>pp0007LedgerSnapshot(tampered),/Unknown PP-0010 closure/);
  }
});
