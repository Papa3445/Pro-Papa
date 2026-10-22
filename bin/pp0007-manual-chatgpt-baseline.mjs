#!/usr/bin/env node
// PP-0007 no-API ChatGPT baseline: operator-run prompt packets and copied transcripts.
// No network, no model calls, no automatic grading and no provider authentication.
import { createHash } from 'node:crypto';
import { open, readFile, realpath, lstat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalTrial } from './pp0007-api-baseline.mjs';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const IDS=new Set(['qa','research','software','document','data','planning','novel']);
const fail=()=>{throw Error('Invalid PP-0007 manual baseline operation')};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function promptPacket(id) {
  const trial=await canonicalTrial(id);
  return {
    schemaVersion:1,taskId:'PP-0007',kind:'operator-chatgpt-baseline-prompt-packet',
    status:'not_collected',caseId:trial.id,category:trial.category,
    fixtureGitBlobSha:trial.fixtureGitBlobSha,
    objectiveSha256:trial.objectiveSha256,inputsSha256:trial.inputsSha256,
    exactUserPrompt:trial.prompt,
    guidance:'Paste exactUserPrompt into a separate fresh direct-ChatGPT conversation. Do not add instructions or modify the canonical objective. Copy the full assistant-visible output into a privately stored UTF-8 text file. Keep a separate private transcript/export and note date, interface, model if known, settings, actual tool permissions, corrections, and human timing; do not invent unavailable measurements.',
    collectedResponse:null,model:null,providerVerified:false,
    taskSuccess:null,qualityGrade:null,toolCalls:null,tokenUsage:null,
    corrections:null,latencyMs:null,comparablePermissions:null,
  };
}

function argsParse(argv) {
  const args={},flags=new Set(['--execute','--prepare','--capture']);
  const valued=new Set(['--case','--out','--transcript']);
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(Object.hasOwn(args,key)||(!flags.has(key)&&!valued.has(key)))fail();
    if(flags.has(key))args[key]=true;
    else {const value=argv[++i];if(!value||value.startsWith('--'))fail();args[key]=value;}
  }
  if(args['--execute']!==true||!IDS.has(args['--case'])||
     !isAbsolute(args['--out']??'')||
     Number(args['--prepare']===true)+Number(args['--capture']===true)!==1||
     (args['--prepare']&&args['--transcript']!==undefined)||
     (args['--capture']&&!isAbsolute(args['--transcript']??'')))fail();
  return args;
}

async function outsideProject(path) {
  const parent=await realpath(dirname(resolve(path)));
  const root=await realpath(ROOT);
  if(parent===root||parent.startsWith(root+sep))fail();
  return parent;
}

async function textFromTranscript(path) {
  await outsideProject(path);
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>262144)fail();
  const bytes=await readFile(path);
  if(bytes.length!==info.size)fail();
  let text;
  try {text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {fail();}
  if(!text.trim()||text.includes('\u0000'))fail();
  return {text,sha256:hash(bytes),byteLength:bytes.length};
}

export async function capturedPacket(id,transcriptPath){
  if(!IDS.has(id)||!isAbsolute(transcriptPath??''))fail();
  const packet=await promptPacket(id);
  const transcript=await textFromTranscript(transcriptPath);
  return {
    schemaVersion:1,taskId:'PP-0007',kind:'operator-supplied-chatgpt-transcript',
    status:'operator_supplied_unverified',caseId:packet.caseId,category:packet.category,
    objectiveSha256:packet.objectiveSha256,inputsSha256:packet.inputsSha256,
    fixtureGitBlobSha:packet.fixtureGitBlobSha,exactUserPrompt:packet.exactUserPrompt,
    source:'operator_copied_local_utf8_text_not_provider_attested',
    providerVerified:false,originalChatExportVerified:false,
    copiedTranscript:transcript.text,transcriptSha256:transcript.sha256,
    transcriptByteLength:transcript.byteLength,
    recordedAt:new Date().toISOString(),
    taskSuccess:null,qualityGrade:null,providerReportedTokens:null,
    correctiveInteractions:null,latencyMs:null,
    actualModel:null,actualToolPermissions:null,sourceConversationUri:null,
    importantLimit:'The file was read and hashed locally. Neither ChatGPT conversation origin, prompt-to-output correspondence, completeness, identity, quality nor timing was independently verified.',
  };
}

export async function main(argv=process.argv.slice(2),log=console.log) {
  const args=argsParse(argv);
  await outsideProject(args['--out']);
  if(args['--capture'] && resolve(args['--transcript'])===resolve(args['--out']))fail();
  // Validate the entire input before reserving the destination. A malformed
  // transcript must not leave an empty file that prevents safe user retry.
  const packet=args['--prepare']?await promptPacket(args['--case']):
    await capturedPacket(args['--case'],args['--transcript']);
  // Only after prevalidation: exclusive private creation, never overwrite.
  const handle=await open(args['--out'],'wx',0o600);
  try{
    await handle.writeFile(JSON.stringify(packet,null,2)+'\n');
    await handle.sync();
    log(JSON.stringify({status:args['--prepare']?'prompt_packet_saved':'operator_transcript_saved',
      caseId:packet.caseId,recordStatus:packet.status,providerVerified:false,
      taskSuccess:null}));
    return packet;
  }finally{await handle.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  main().catch(()=>{console.log(JSON.stringify({status:'manual_baseline_not_recorded'}));
    process.exitCode=1;});
}
