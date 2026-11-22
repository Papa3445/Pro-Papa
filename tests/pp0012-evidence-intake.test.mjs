import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateProject,selectNext} from '../src/core.mjs';
import {pp0012RegistrationSnapshot,pp0012ScopeSnapshot,pp0007LedgerSnapshot} from './pp0008-historical-pin-helper.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const raw=read('.pro-papa/tasks.json'), state=JSON.parse(raw), prior=pp0012RegistrationSnapshot(state);
const get=(l,id)=>l.tasks.find(t=>t.id===id);
const work=get(state,'PP-0012');
const report=json('.pro-papa/evidence/PP-0012/cli-registration-provenance.json');
test('PP-0012 genuine CLI registration preserves exact protected scope and unrelated tasks',()=>{
 assert.equal(blob(raw),'efcc1755c99a52dabcd993c304d170d2a70c57f8');
 assert.equal(state.revision,98);
 assert.equal(prior.revision,94);
 assert.equal(blob(Buffer.from(JSON.stringify(prior,null,2)+'\n')),'906ec8c106af421c51a0e8d99d5e81d849d98209');
 assert.equal(work.status,'in_progress');assert.equal(work.owner,'chatgpt-implementation');
 assert.equal(work.verifiedAt,undefined);
 assert.equal(state.tasks.filter(t=>t.status==='verified').length,11);
 assert.equal(state.tasks.filter(t=>t.status==='in_progress').length,1);
 assert.equal(get(state,'PP-0013').status,'pending');
 assert.deepEqual(get(state,'PP-0012').acceptance,get(prior,'PP-0012').acceptance);
 for(const t of state.tasks.filter(t=>t.id!=='PP-0012'))assert.deepEqual(t,get(prior,t.id));
 assert.equal(selectNext(state)?.id,'PP-0012');
 assert.equal(validateProject(state,json('.pro-papa/profiles.json')),true);
 assert.equal(pp0012ScopeSnapshot(state).revision,93);
 assert.equal(pp0007LedgerSnapshot(state).canonicalBlob,'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
});
test('PP-0012 exact three source-backed proof digests and authenticated prior reviewer, not closure',()=>{
 assert.deepEqual(work.evidence.map(p=>p.kind),['artifact','validation','review']);
 assert.deepEqual(work.evidence,report.actualRegistration.proofs);
 assert.equal(report.actualRegistration.ledgerGitBlob,'efcc1755c99a52dabcd993c304d170d2a70c57f8');
 assert.equal(report.source.runId,44973990408);
 assert.equal(report.source.jobId,137059684319);
 assert.equal(report.source.runCommit,'49c92272070bf097e20ebdf959ae5f66ec9d75f5');
 assert.deepEqual(work.reviewTarget,{repository:'Papa3445/Pro-Papa',pullRequest:77,baseRef:'main',baseSha:'8fc9d709f4bd412a8ac40654185dac5c3bb28287'});
 assert.equal(work.requiresTrustedReview,true);
 assert.equal(work.evidence.at(-1).actor,'papa4568');
 assert.notEqual(work.evidence.at(-1).actor,work.owner);
 const review=report.actualRegistration.authenticatedReview;
 assert.equal(review.verdict,'PASS');assert.equal(review.reviewId,6009529716);
 assert.equal(review.candidateSha,'9efa40438443b73ee166b824233f1718b1b32af5');
 for(const p of work.evidence){
  assert.equal(p.result,'pass');
  assert.equal(createHash('sha256').update(read(p.path)).digest('hex'),p.sha256);
  assert.equal(json(p.path).taskId,'PP-0012');
  assert.equal(json(p.path).evidenceKind,p.kind);
 }
 assert.equal(report.boundaries.formalCloseExecuted,false);
 assert.equal(report.boundaries.intakeReviewPending,true);
 assert.equal(report.boundaries.deploy,false);
});
test('PP-0012 evidence registration rejects tampering, unauthorized closure, review pin changes or unrelated security mutation',()=>{
 for(const mutate of [
  x=>{get(x,'PP-0012').status='verified';},
  x=>{get(x,'PP-0012').evidence[0].sha256='0'.repeat(64);},
  x=>{get(x,'PP-0012').reviewTarget.pullRequest=78;},
  x=>{get(x,'PP-0012').requiresTrustedReview=false;},
  x=>{get(x,'PP-0012').evidence[2].actor='chatgpt-implementation';},
  x=>{get(x,'PP-0013').acceptance.pop();},
  x=>{get(x,'PP-0011').verifiedAt='2020-01-01T00:00:00.000Z';},
 ]){const t=structuredClone(state);mutate(t);assert.throws(()=>pp0012RegistrationSnapshot(t),/Unknown ledger mutation: PP-0012 evidence registration/);assert.throws(()=>pp0007LedgerSnapshot(t),/Unknown ledger mutation: PP-0012 evidence registration/);}
 const bad=structuredClone(state);bad.revision=99;assert.throws(()=>pp0007LedgerSnapshot(bad),/Unknown ledger mutation/);
});
