import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pp0011RegistrationSnapshot,pp0011ClosureSnapshot,pp0007LedgerSnapshot,pp0012ScopeSnapshot} from './pp0008-historical-pin-helper.mjs';
const base=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,base));
const sha=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');
const original=Buffer.from(JSON.stringify(pp0012ScopeSnapshot(JSON.parse(read('.pro-papa/tasks.json'))),null,2)+'\n');
const candidate=JSON.parse(original);
const current=pp0011ClosureSnapshot(candidate);
const intakeBytes=Buffer.from(JSON.stringify(current,null,2)+'\n');
const spec=[
['artifact','.pro-papa/evidence/PP-0011/host-domain-outcomes-2026-11-15.json','976ce48cadacf074298815a308573c907ace7d899d4390a3d649c3fb5eca850f'],
['validation','.pro-papa/evidence/PP-0011/host-validation-2026-11-15.json','aed66357cce6b6d86c064fd95a14d41f445a6451b6cb0a34bda907f800fd36c8'],
['review','.pro-papa/evidence/PP-0011/independent-scope-reviews-2026-11-15.json','05356d4d64edcea051127d8986b303f45b7d86be5a1e81f41b7693f3944d24f9'],
];
test('PP-0011 exact source-pinned intake changes only its own task; historical ledger fully restored',()=>{
 assert.equal(current.revision,92);
 assert.equal(gitBlob(original),'9b1e4dba9d37fc0b440d23d5ae46c1ccaab95eff');
 assert.equal(gitBlob(intakeBytes),'37a35059c4a426ae7f0d23997bae40b961df08aa');
 const work=current.tasks.find(x=>x.id==='PP-0011');
 assert.equal(work.status,'in_progress');
 assert.equal(work.owner,'chatgpt-implementation');
 assert.equal(work.requiresTrustedReview,true);
 assert.deepEqual(work.reviewTarget,{repository:'Papa3445/Pro-Papa',pullRequest:74,
   baseRef:'main',baseSha:'5d84f80cb36509fa20d50f87551461bba2804a79'});
 assert.deepEqual(work.evidence.map(x=>[x.kind,x.path,x.sha256]),spec);
 for(const [kind,path,digest] of spec){
  const bytes=read(path);
  assert.equal(sha(bytes),digest,kind);
  const report=JSON.parse(bytes);
  assert.equal(report.taskId,'PP-0011');
  assert.equal(report.result,'pass');
  assert.equal(report.evidenceKind,kind);
  assert.equal(report.metadataOnly,true);
 }
 const base91=pp0011RegistrationSnapshot(current);
 assert.equal(base91.revision,91);
 assert.equal(gitBlob(Buffer.from(JSON.stringify(base91,null,2)+'\n')),
   'b2a886e3c26ad35775a38c634a61390b7f2b2a9a');
 assert.equal(pp0007LedgerSnapshot(current).canonicalBlob,
   'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
 assert.equal(current.tasks.find(x=>x.id==='PP-0012').status,'pending');
 assert.equal(current.tasks.find(x=>x.id==='PP-0013').status,'pending');
});
test('PP-0011 intake historical normalization rejects task, proof and authorization tampering',()=>{
 for(const change of [
  x=>{x.tasks.find(t=>t.id==='PP-0011').status='verified';},
  x=>{x.tasks.find(t=>t.id==='PP-0011').evidence[0].sha256='0'.repeat(64);},
  x=>{x.tasks.find(t=>t.id==='PP-0011').reviewTarget.pullRequest=73;},
  x=>{x.tasks.find(t=>t.id==='PP-0007').evidence.pop();},
  x=>{x.tasks.find(t=>t.id==='PP-0010').verifiedAt='2020-01-01T00:00:00.000Z';},
  x=>{x.tasks.find(t=>t.id==='PP-0012').status='in_progress';},
 ]){
  const tampered=structuredClone(current);change(tampered);
  assert.throws(()=>pp0011RegistrationSnapshot(tampered),/Unknown PP-0011 evidence intake/);
  assert.throws(()=>pp0007LedgerSnapshot(tampered),/Unknown PP-0011 evidence intake/);
 }
});

test('PP-0011 outcome document matches canonical active status and bounded acceptance',()=>{
 const doc=read('docs/PP0011-OUTCOME-AND-ROLLBACK.md').toString('utf8');
 const work=current.tasks.find(x=>x.id==='PP-0011');
 assert.equal(current.revision,92);
 assert.equal(work.status,'in_progress');
 assert.match(doc,/revision 92/);
 assert.match(doc,/in_progress/);
 assert.match(doc,/APPROVE #5913367526/);
 assert.match(doc,/PR #74/);
 assert.match(doc,/issue #37/);
 assert.match(doc,/opening-text preview/);
 assert.match(doc,/PP-0012 owns the original paired benchmark/);
 assert.match(doc,/PP-0013 owns deferred credential-sensitive production/);
 assert.doesNotMatch(doc,/PP-0011 (?:remains|stays) pending/i);
 assert.doesNotMatch(doc,/ledger is (?:at )?revision 91 with PP-0011/i);
});
