import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, symlink, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalTrial } from '../bin/pp0007-api-baseline.mjs';
import { promptPacket, capturedPacket, main } from '../bin/pp0007-manual-chatgpt-baseline.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');

test('all seven prompts are byte-identical to SHA-pinned canonical inputs; no placeholders become trials',async()=>{
  const ids=['qa','research','software','document','data','planning','novel'];
  const prompts=[];
  for(const id of ids){
    const trial=await canonicalTrial(id),p=await promptPacket(id);
    assert.equal(p.exactUserPrompt,trial.prompt);
    assert.equal(p.objectiveSha256,trial.objectiveSha256);
    assert.equal(p.inputsSha256,trial.inputsSha256);
    assert.equal(p.fixtureGitBlobSha,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
    assert.equal(p.status,'not_collected');
    assert.equal(p.collectedResponse,null);
    assert.equal(p.taskSuccess,null);
    assert.equal(p.providerVerified,false);
    prompts.push(p.exactUserPrompt);
  }
  assert.equal(new Set(prompts).size,7);
  assert.equal(prompts[0],'What is the capital city of France?');
  assert.equal(prompts[1],'Research repository metadata with a provider URL\nCanonical inputs (JSON): {"repository":"Papa3445/Pro-Papa"}');
});

test('capture preserves exact operator text, SHA-256, truthful unverified provenance, and null scores',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pp7-chatgpt-capture-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const bytes=Buffer.from('Paris\n\nExact copied answer.\n','utf8');
  const transcript=join(dir,'transcript.txt');await writeFile(transcript,bytes,{mode:0o600});
  const item=await capturedPacket('qa',transcript);
  assert.equal(item.copiedTranscript,bytes.toString('utf8'));
  assert.equal(item.transcriptSha256,sha(bytes));
  assert.equal(item.transcriptByteLength,bytes.length);
  assert.equal(item.source,'operator_copied_local_utf8_text_not_provider_attested');
  assert.equal(item.providerVerified,false);
  assert.equal(item.originalChatExportVerified,false);
  assert.equal(item.actualModel,null);
  assert.equal(item.taskSuccess,null);
  assert.equal(item.qualityGrade,null);
  assert.equal(item.providerReportedTokens,null);
  assert.equal(item.correctiveInteractions,null);
  assert.equal(item.latencyMs,null);
  assert.equal(item.sourceConversationUri,null);
  assert.match(item.recordedAt,/^\d{4}-\d{2}-\d{2}T/);
});

test('both commands require explicit execution, valid case, private absolute output and correct mode flags',async()=>{
  const bad=[
    [],
    ['--prepare','--case','qa','--out','/tmp/packet.json'],
    ['--execute','--case','qa','--out','/tmp/packet.json'],
    ['--execute','--prepare','--capture','--case','qa','--out','/tmp/packet.json'],
    ['--execute','--prepare','--case','bogus','--out','/tmp/packet.json'],
    ['--execute','--prepare','--case','qa','--out','relative.json'],
    ['--execute','--prepare','--case','qa','--out','/tmp/packet.json','--transcript','/tmp/private.txt'],
    ['--execute','--capture','--case','qa','--out','/tmp/packet.json'],
    ['--execute','--capture','--case','qa','--out','/tmp/packet.json','--transcript','relative.txt'],
    ['--execute','--execute','--prepare','--case','qa','--out','/tmp/packet.json'],
    ['--execute','--prepare','--case','qa','--out','/tmp/packet.json','--api-key','fake'],
  ];
  for(const args of bad)await assert.rejects(main(args,()=>{}),/Invalid PP-0007/);
});

test('prepare writes a new 0600 operator prompt packet and refuses overwrite',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pp7-chatgpt-packet-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'qa.json'),logs=[];
  await main(['--execute','--prepare','--case','qa','--out',path],s=>logs.push(JSON.parse(s)));
  assert.equal(logs.length,1);
  assert.deepEqual(logs[0],{status:'prompt_packet_saved',caseId:'qa',recordStatus:'not_collected',
    providerVerified:false,taskSuccess:null});
  const data=JSON.parse(await readFile(path,'utf8'));
  assert.equal(data.exactUserPrompt,'What is the capital city of France?');
  assert.equal((await stat(path)).mode&0o777,0o600);
  await assert.rejects(main(['--execute','--prepare','--case','qa','--out',path],()=>{}),{code:'EEXIST'});
  assert.equal((await readFile(path,'utf8')).includes('What is the capital'),true);
});

test('capture writes a new 0600 private record and does not print any transcript content',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pp7-chatgpt-private-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const src=join(dir,'chatgpt.txt'),dst=join(dir,'saved.json');
  await writeFile(src,'Private user text that should not appear in logs.',{mode:0o600});
  const logs=[];
  await main(['--execute','--capture','--case','document','--transcript',src,'--out',dst],
    str=>logs.push(str));
  const saved=JSON.parse(await readFile(dst,'utf8'));
  assert.equal(saved.copiedTranscript,'Private user text that should not appear in logs.');
  assert.equal(saved.taskSuccess,null);
  assert.equal(saved.providerVerified,false);
  assert.equal((await stat(dst)).mode&0o777,0o600);
  assert.equal(logs.length,1);
  assert.ok(!logs[0].includes('Private user text'));
  await assert.rejects(main(['--execute','--capture','--case','document','--transcript',src,'--out',src],()=>{}),/Invalid PP-0007/);
});

test('malformed input transcripts cannot be silently accepted or treated as provider replies',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pp7-chatgpt-failclosed-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'input.txt'),link=join(dir,'link.txt');
  for(const bytes of [Buffer.alloc(0),Buffer.from([0xff]),Buffer.from([0,65]),
    Buffer.alloc(262145,65),Buffer.from(' \n\n ')]) {
    await writeFile(file,bytes);
    await assert.rejects(capturedPacket('qa',file),/Invalid PP-0007/);
  }
  await writeFile(file,'Paris');
  await symlink(file,link);
  await assert.rejects(capturedPacket('qa',link),/Invalid PP-0007/);
  await assert.rejects(capturedPacket('invalid',file),/Invalid PP-0007/);
});


test('P3 reviewer regression: invalid capture leaves no reserved output; valid retry works with same filename',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pp7-chatgpt-retry-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const source=join(dir,'copied-response.txt'),destination=join(dir,'record.json');
  const argv=['--execute','--capture','--case','qa','--transcript',source,'--out',destination];
  for (const invalid of [Buffer.from([0xff]),Buffer.from('  \n'),Buffer.from([0, 65])]) {
    await writeFile(source,invalid,{mode:0o600});
    await assert.rejects(main(argv,()=>{}),/Invalid PP-0007/);
    await assert.rejects(stat(destination),{code:'ENOENT'});
  }
  await rm(source);
  await assert.rejects(main(argv,()=>{}),{code:'ENOENT'});
  await assert.rejects(stat(destination),{code:'ENOENT'});
  await writeFile(source,'Paris', {mode:0o600});
  const observed=[];
  const result=await main(argv,str=>observed.push(JSON.parse(str)));
  assert.equal(result.status,'operator_supplied_unverified');
  assert.equal(result.copiedTranscript,'Paris');
  assert.equal(result.taskSuccess,null);
  assert.equal((await stat(destination)).mode&0o777,0o600);
  assert.equal(observed.length,1);
  assert.equal(observed[0].status,'operator_transcript_saved');
  await assert.rejects(main(argv,()=>{}),{code:'EEXIST'});
  assert.equal(JSON.parse(await readFile(destination,'utf8')).copiedTranscript,'Paris');
});
