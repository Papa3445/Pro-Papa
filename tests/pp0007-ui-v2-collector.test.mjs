// PP-0007 prospective UI-v2: private operator I/O is not provider-authenticated evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,stat,lstat,rm,symlink,mkdir,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildPacket,loadStudy,main,validateSchedule,verifyStudyBytes} from '../bin/pp0007-ui-v2-collector.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
async function privateDir(t){
  const dir=await mkdtemp(join(tmpdir(),'pp0007-ui-v2-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  return dir;
}

test('prospective packet preserves seven frozen prompts and all 42 preregistered slots',async()=>{
  const {spec,contractSha256,originalFixtureBlob}=await loadStudy();
  assert.match(contractSha256,/^[0-9a-f]{64}$/);
  assert.equal(originalFixtureBlob,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
  let slots=0,firstRegular=0,firstProject=0; const identities=new Set();
  for(const c of spec.caseDefinitions){
    for(let rep=1;rep<=3;rep++){
      const order=spec.orderByCase[c.id][rep-1];
      for(const arm of order){
        const packet=await buildPacket({caseId:c.id,repetition:rep,arm});
        assert.equal(packet.exactUserPrompt,c.submittedPrompt);
        assert.equal(packet.positionInPair,order.indexOf(arm)+1);
        assert.equal(packet.expectedPromptSha256,sha(Buffer.from(c.submittedPrompt,'utf8')));
        assert.equal(packet.contractSha256,contractSha256);
        const identity=JSON.stringify([packet.caseId,packet.repetition,packet.arm]);
        assert.equal(identities.has(identity),false,'each prospective slot must be distinct');
        identities.add(identity);
        assert.equal(packet.status,'not_collected');
        assert.equal(packet.providerAuthenticated,false);
        assert.equal(packet.observedAnswer,null);
        assert.equal(packet.grade,null);
        assert.equal(packet.taskComplete,null);
        slots++;
      }
      if(order[0]==='regular')firstRegular++;else firstProject++;
    }
  }
  assert.equal(slots,42);assert.equal(identities.size,42);
  assert.deepEqual([firstRegular,firstProject],[11,10]);
});


test('P1 independent review: reject duplicate non-QA arms and missing 42-slot identities',async()=>{
  const original=await readFile(new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url));
  const raw=await readFile(new URL('../fixtures/pp0007-ui-v2-contract.json',import.meta.url));
  const spec=JSON.parse(raw);
  const bad=structuredClone(spec);
  bad.orderByCase.software[0]=['regular','regular'];
  assert.throws(()=>validateSchedule(bad),/Invalid PP-0007/);
  assert.throws(()=>verifyStudyBytes(Buffer.from(JSON.stringify(bad)),original),/Invalid PP-0007/);
  const noPair=structuredClone(spec);
  noPair.orderByCase.software.splice(1,1);
  assert.throws(()=>validateSchedule(noPair),/Invalid PP-0007/);
  const extra=structuredClone(spec);
  extra.orderByCase.injected=[['regular','project'],['project','regular'],['regular','project']];
  assert.throws(()=>validateSchedule(extra),/Invalid PP-0007/);
});

test('P1 independent review: immutable predeclared bytes reject balanced reorders and altered formatting',async()=>{
  const original=await readFile(new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url));
  const raw=await readFile(new URL('../fixtures/pp0007-ui-v2-contract.json',import.meta.url));
  const {contractSha256}=verifyStudyBytes(raw,original);
  assert.equal(contractSha256,'a7d6c57a838e24358c34cc4dba2035d6cefd50d1361dbf08b9bcfe9f13b7e298');
  const changed=JSON.parse(raw);
  changed.orderByCase.software[0]=['project','regular'];
  changed.orderByCase.data[0]=['regular','project'];
  assert.doesNotThrow(()=>validateSchedule(changed),'still has balanced 11:10 ordering');
  assert.throws(()=>verifyStudyBytes(Buffer.from(JSON.stringify(changed)),original),/Invalid PP-0007/,
    'predeclared exact order cannot be rewritten and rehashed');
  const reformatted=Buffer.from(raw.toString('utf8')+'\n');
  assert.throws(()=>verifyStudyBytes(reformatted,original),/Invalid PP-0007/,
    'even a byte-format mutation needs an independently reviewed new contract');
  const reordered=JSON.stringify({status:changed.status,...JSON.parse(raw)});
  assert.throws(()=>verifyStudyBytes(Buffer.from(reordered),original),/Invalid PP-0007/);
  const corruptedOriginal=Buffer.from(original.toString('utf8')+'\n');
  assert.throws(()=>verifyStudyBytes(raw,corruptedOriginal),/Invalid PP-0007/);
});

test('explicit prepare captures only the selected arm/repetition in owner-private mode',async t=>{
  const dir=await privateDir(t),out=join(dir,'packet.json'),log=[];
  await main(['--execute','--prepare','--case','research','--rep','2','--arm','project',
    '--out',out],s=>log.push(s));
  const packet=JSON.parse(await readFile(out,'utf8'));
  assert.equal(packet.positionInPair,1);
  assert.equal(packet.caseId,'research');
  assert.equal(packet.exactUserPrompt,
    'Research repository metadata with a provider URL\nCanonical inputs (JSON): {"repository":"Papa3445/Pro-Papa"}');
  assert.equal((await stat(out)).mode&0o777,0o600);
  assert.ok(!log[0].includes('Papa3445/Pro-Papa'));
  await assert.rejects(main(['--execute','--prepare','--case','research','--rep','2',
    '--arm','project','--out',out],()=>{}),{code:'EEXIST'});
});

test('capture checks byte-exact submitted prompt and hashes response without false attestation',async t=>{
  const dir=await privateDir(t),sent=join(dir,'sent.txt'),answer=join(dir,'answer.txt');
  const out=join(dir,'capture.json'),log=[];
  await writeFile(sent,'What is the capital city of France?',{mode:0o600});
  await writeFile(answer,'Paris.\n\nFull copied answer.\n',{mode:0o600});
  await main(['--execute','--capture','--case','qa','--rep','1','--arm','regular',
    '--sent',sent,'--response',answer,'--out',out],s=>log.push(s));
  const packet=JSON.parse(await readFile(out,'utf8'));
  assert.equal(packet.promptParityVerified,true);
  assert.equal(packet.actualPromptSha256,packet.expectedPromptSha256);
  assert.equal(packet.observedAnswer,'Paris.\n\nFull copied answer.\n');
  assert.equal(packet.answerSha256,sha(Buffer.from(packet.observedAnswer)));
  assert.equal(packet.answerByteLength,Buffer.byteLength(packet.observedAnswer));
  assert.equal(packet.status,'operator_supplied_unverified');
  for(const key of ['grade','taskComplete','actualModel','latencyMs','actualToolCalls',
    'providerReportedTokens','correctionTurns','githubReceiptVerified',
    'sharedSoftwareTestsVerified'])assert.equal(packet[key],null,key);
  assert.equal(packet.providerAuthenticated,false);
  assert.equal(packet.responseCompletenessVerified,false);
  assert.equal((await stat(out)).mode&0o777,0o600);
  assert.equal(log.length,1);
  assert.ok(!log[0].includes('Paris'));
  assert.ok(!log[0].includes('Full copied answer'));
});

test('mismatch, malformed transcripts, missing inputs and symlinks fail before output creation',async t=>{
  const dir=await privateDir(t),sent=join(dir,'sent.txt'),answer=join(dir,'answer.txt');
  const out=join(dir,'capture.json');
  const argv=['--execute','--capture','--case','qa','--rep','1','--arm','project',
    '--sent',sent,'--response',answer,'--out',out];
  await writeFile(answer,'Paris',{mode:0o600});
  for(const badPrompt of ['What is the capital city of France?\n',
    'What is the capital city of France? [project extra instructions]',
    'Calculate 2+3+5']) {
    await writeFile(sent,badPrompt,{mode:0o600});
    await assert.rejects(main(argv,()=>{}),/Invalid PP-0007/);
    await assert.rejects(lstat(out),{code:'ENOENT'});
  }
  await writeFile(sent,'What is the capital city of France?',{mode:0o600});
  for(const invalid of [Buffer.from([0xff]),Buffer.from([0x00,0x41]),Buffer.from('  \n'),
    Buffer.alloc(262145,65)]){
    await writeFile(answer,invalid,{mode:0o600});
    await assert.rejects(main(argv,()=>{}),/Invalid PP-0007/);
    await assert.rejects(lstat(out),{code:'ENOENT'});
  }
  await rm(answer);
  await assert.rejects(main(argv,()=>{}),{code:'ENOENT'});
  await writeFile(answer,'Paris');
  const link=join(dir,'answer-link.txt');
  await symlink(answer,link);
  await assert.rejects(main(argv.map(x=>x===answer?link:x),()=>{}),/Invalid PP-0007/);
  await main(argv,()=>{});
  assert.equal(JSON.parse(await readFile(out,'utf8')).observedAnswer,'Paris');
});

test('refuse implicit execution, invalid slots, public directories and aliasing inputs/outputs',async t=>{
  const dir=await privateDir(t),out=join(dir,'capture.json');
  for(const args of [
    ['--prepare','--case','qa','--rep','1','--arm','regular','--out',out],
    ['--execute','--prepare','--capture','--case','qa','--rep','1','--arm','regular','--out',out],
    ['--execute','--prepare','--case','qa','--rep','0','--arm','regular','--out',out],
    ['--execute','--prepare','--case','qa','--rep','4','--arm','regular','--out',out],
    ['--execute','--prepare','--case','x','--rep','1','--arm','regular','--out',out],
    ['--execute','--prepare','--case','qa','--rep','1','--arm','bad','--out',out],
    ['--execute','--prepare','--case','qa','--rep','1','--arm','regular','--out','relative.json'],
    ['--execute','--prepare','--case','qa','--rep','1','--arm','regular','--out',out,'--execute'],
  ]) await assert.rejects(main(args,()=>{}),/Invalid PP-0007/);
  const shared=join(dir,'shared');await mkdir(shared,{mode:0o777});await chmod(shared,0o777);
  await assert.rejects(main(['--execute','--prepare','--case','qa','--rep','1',
    '--arm','regular','--out',join(shared,'x.json')],()=>{}),/Invalid PP-0007/);
  await assert.rejects(buildPacket({caseId:'qa',repetition:1,arm:'regular',
    sentPath:out,responsePath:out}),/Invalid PP-0007/);
});
