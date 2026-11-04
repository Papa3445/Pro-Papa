import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPdfReleaseWorkflow } from '../src/pdf-release-workflow.mjs';
import { createReferenceHost } from '../src/reference-host.mjs';

// Minimal genuine PDF with checked classic xref offsets and visible text.
function pdf(message='PP0010 verified release') {
  const stream = 'BT /F1 12 Tf 72 200 Td (' + message + ') Tj ET';
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream'];
  let raw = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(raw, 'latin1');
    raw += i + ' 0 obj\n' + objects[i] + '\nendobj\n';
  }
  const at = Buffer.byteLength(raw, 'latin1');
  raw += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objects.length; i++)
    raw += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  raw += 'trailer\n<< /Size ' + objects.length +
    ' /Root 1 0 R >>\nstartxref\n' + at + '\n%%EOF\n';
  return Buffer.from(raw, 'latin1');
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const valid = pdf();
const config = extra => ({
  enabled: true,
  produce: async () => Buffer.from(valid),
  publish: async bytes => ({sha256: sha(bytes), byteLength: bytes.length}),
  readPublished: async () => Buffer.from(valid), // Isolated mock for unit checks only
  requiredText: ['PP0010 verified release'],
  ...extra,
});

test('PP-0010 authorized host release writes and reads back exact submitted PDF bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pp0010-'));
  const target = join(dir, 'approved.pdf');
  try {
    let published = 0;
    const gate = createPdfReleaseWorkflow(config({
      publish: async bytes => {
        published++;
        await writeFile(target, bytes);
        return {sha256: sha(bytes), byteLength: bytes.length};
      },
      readPublished: () => readFile(target),
    }));
    const outcome = await gate.run();
    assert.equal(outcome.status, 'released');
    assert.equal(outcome.sha256, sha(valid));
    assert.equal(outcome.hostReadbackMatched, true);
    assert.equal(outcome.requiredChecks, 1);
    assert.equal(published, 1);
    assert.deepEqual(await readFile(target), valid);
    assert.ok(!JSON.stringify(outcome).includes('PP0010 verified release'));
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('PP-0010 missing checks, disabled grants and untrusted overrides cannot publish', async () => {
  let produced = 0, published = 0;
  const producer = async () => { produced++; return valid; };
  const publish = async () => { published++; return {sha256:sha(valid),byteLength:valid.length}; };
  const opts = {produce:producer,publish};
  assert.deepEqual(await createPdfReleaseWorkflow(config({
    ...opts, enabled:false,
  })).run(), {status:'not_released',reason:'disabled'});
  assert.equal(produced,0);
  const gate = createPdfReleaseWorkflow(config({...opts}));
  assert.equal((await gate.run({skipValidation:true,publish})).status,'not_released');
  assert.equal(produced,0);
  assert.equal((await createPdfReleaseWorkflow(config({
    ...opts,requiredText:['Nonexistent approval phrase'],
  })).run()).status, 'not_released');
  assert.equal(published,0);
  assert.equal(produced,1);
});

test('PP-0010 stale digest and wrong artifact bytes fail before publishing', async () => {
  let published = 0;
  const publish = async () => {published++;};
  const mismatch = createPdfReleaseWorkflow(config({
    expectedSha256:sha(pdf('Outdated document')),publish,
  }));
  assert.deepEqual(await mismatch.run(),
    {status:'not_released',reason:'stale_or_mismatched_artifact'});
  assert.equal(published,0);
  const wrong = createPdfReleaseWorkflow(config({
    produce:async()=>Buffer.from('%PDF-1.4\n%%EOF\n'),publish,
  }));
  assert.equal((await wrong.run()).status,'not_released');
  assert.equal(published,0);
});

test('PP-0010 forged audit, missing validator and replayed valid trace fail closed', async () => {
  let published = 0;
  const publish = async()=>{published++;return {sha256:sha(valid),byteLength:valid.length};};
  const forged = createPdfReleaseWorkflow(config({
    publish,validationHost:{execute:async()=>({
      status:'completed',capability:'artifact.validate',
      audit:{status:'confirmed',receiptCommit:'a'.repeat(40)},
      trace:{state:'released'},execution:{output:{sha256:sha(valid)}},
    })},
  }));
  assert.equal((await forged.run()).reason,'validation_failed');
  const missing = createPdfReleaseWorkflow(config({
    publish,validationHost:{execute:async()=>{throw Error('Secret provider error');}},
  }));
  const unavailable = await missing.run();
  assert.equal(unavailable.reason,'validator_unavailable');
  assert.ok(!JSON.stringify(unavailable).includes('Secret provider error'));
  const host = createReferenceHost({traceMode:'enforced',artifactValidationEnabled:true});
  const other = pdf('PP0010 validated different document');
  const staleResponse = await host.execute({
    objective:'Validate different actual PDF bytes',capability:'artifact.validate',
    inputs:{authorization:'validate_supplied_bytes_only',format:'application/pdf',
      dataBase64:other.toString('base64'),
      mustContain:['PP0010 validated different document']},
  });
  assert.equal(staleResponse.status,'completed');
  const replay = createPdfReleaseWorkflow(config({
    publish,validationHost:{execute:async()=>staleResponse},
  }));
  assert.equal((await replay.run()).reason,'validation_failed');
  assert.equal(published,0);
});

test('PP-0010 publication failure is ambiguous, never falsely reported as denied', async () => {
  for (const publish of [async()=>{throw Error('failed after write');},
    async()=>({sha256:'0'.repeat(64),byteLength:valid.length})]) {
    const result = await createPdfReleaseWorkflow(config({publish})).run();
    assert.deepEqual(result,{status:'needs_reconciliation',
      reason:'publication_unconfirmed'});
  }
});

test('PP-0010 rejects invalid trusted policy before any work', () => {
  for (const invalid of [
    {requiredText:[]},{requiredText:['']},{requiredText:['same','same']},
    {requiredText:['é']},{requiredText:['x'.repeat(81)]},
    {expectedSha256:'not-a-hash'},
    {publish:null},{readPublished:null},{produce:null},{validationHost:{}},
  ]) assert.throws(()=>createPdfReleaseWorkflow(config(invalid)),
    /Invalid trusted PDF release configuration/);
});

test('PP-0010 single-use workflow blocks replay and concurrent publication',async()=>{
  let startProducer, published=0;
  const producer = () => new Promise(resolve=>{ startProducer=resolve; });
  const workflow = createPdfReleaseWorkflow(config({
    produce:producer,
    publish:async bytes=>{published++;return {sha256:sha(bytes),byteLength:bytes.length};},
  }));
  const first=workflow.run();
  const second=await workflow.run();
  assert.deepEqual(second,{status:'not_released',reason:'already_attempted'});
  startProducer(Buffer.from(valid));
  assert.equal((await first).status,'released');
  assert.equal(published,1);
  assert.equal((await workflow.run()).reason,'already_attempted');
  const denied=createPdfReleaseWorkflow(config({
    produce:async()=>{throw Error('one-time producer failure');},
  }));
  assert.equal((await denied.run()).reason,'producer_failed');
  assert.equal((await denied.run()).reason,'already_attempted');
});


test('PP-0010 forged matching publisher acknowledgment without persistence cannot release',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pp0010-missing-'));
  const absent=join(dir,'not-written.pdf');
  try {
    let calls=0;
    const gate=createPdfReleaseWorkflow(config({
      publish:async (_bytes,metadata)=>{calls++;return {...metadata};},
      readPublished:()=>readFile(absent),
    }));
    assert.deepEqual(await gate.run(),{status:'needs_reconciliation',
      reason:'publication_unconfirmed'});
    assert.equal(calls,1);
    assert.equal((await gate.run()).reason,'already_attempted');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('PP-0010 persisted wrong bytes and false publisher acknowledgment do not release',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pp0010-wrong-'));
  const target=join(dir,'wrong.pdf');
  try{
    const gate=createPdfReleaseWorkflow(config({
      publish:async(_bytes,metadata)=>{
        await writeFile(target,pdf('Tampered after publish'));
        return {...metadata};
      },
      readPublished:()=>readFile(target),
    }));
    assert.equal((await gate.run()).status,'needs_reconciliation');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('PP-0010 same-PDF stale successful validation under a different policy fails closed',async()=>{
  let published=0;
  const original=createReferenceHost({traceMode:'enforced',artifactValidationEnabled:true});
  const old=await original.execute({
    objective:'Original easy PDF validation',capability:'artifact.validate',
    inputs:{authorization:'validate_supplied_bytes_only',format:'application/pdf',
      dataBase64:valid.toString('base64'),mustContain:['PP0010']},
  });
  assert.equal(old.status,'completed');
  const stale=createPdfReleaseWorkflow(config({
    requiredText:['NOT IN THE SAME PDF'],
    validationHost:{execute:async()=>old},
    publish:async()=>{published++;},
  }));
  assert.equal((await stale.run()).reason,'validation_failed');
  assert.equal(published,0);
});
