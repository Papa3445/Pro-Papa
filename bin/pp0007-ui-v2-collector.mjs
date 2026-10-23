#!/usr/bin/env node
// PP-0007 prospective UI v2: local, operator-run collection only.
// No browser/model calls, GitHub side effects, automatic grading, or provider attestation.
import {createHash} from 'node:crypto';
import {lstat, open, readFile, realpath, stat} from 'node:fs/promises';
import {dirname, isAbsolute, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const SPEC=new URL('../fixtures/pp0007-ui-v2-contract.json',import.meta.url);
const FROZEN=new URL('../fixtures/pp0007-paired-trial-collection-template.json',import.meta.url);
const ORIGINAL_BLOB='aa07d8296ab8c4ad492ec02863bd4203bb90ead4';
// Independent review #21: immutable SHA-256 of preregistered v2 raw bytes
// from trusted main at fb9b568. A fresh self-hash is not proof of registration.
const REGISTERED_V2_SHA256='a7d6c57a838e24358c34cc4dba2035d6cefd50d1361dbf08b9bcfe9f13b7e298';
const fail=()=>{throw Error('Invalid PP-0007 UI-v2 collection operation')};
const sha256=data=>createHash('sha256').update(data).digest('hex');

// Structural safety is checked *in addition to* the pinned preregistration.
// Distinct identities (case, repetition, arm) forbid duplicate-arm pairs.
export function validateSchedule(spec){
  if(!spec||!Array.isArray(spec.caseDefinitions)||spec.caseDefinitions.length!==7||
     !spec.orderByCase||typeof spec.orderByCase!=='object'||
     Array.isArray(spec.orderByCase))fail();
  const ids=spec.caseDefinitions.map(c=>c.id);
  if(new Set(ids).size!==7||ids.some(id=>typeof id!=='string')||
     Object.keys(spec.orderByCase).length!==ids.length||
     Object.keys(spec.orderByCase).some(id=>!ids.includes(id)))fail();
  const slots=new Set();
  let regularFirst=0,projectFirst=0;
  for(const id of ids){
    const repetitions=spec.orderByCase[id];
    if(!Array.isArray(repetitions)||repetitions.length!==3)fail();
    for(let i=0;i<3;i++){
      const pair=repetitions[i];
      if(!Array.isArray(pair)||pair.length!==2||
         !(['regular','project'].every(arm=>pair.includes(arm)))||
         new Set(pair).size!==2)fail();
      if(pair[0]==='regular')regularFirst++;else projectFirst++;
      for(const arm of pair){
        const slot=JSON.stringify([id,i+1,arm]);
        if(slots.has(slot))fail();
        slots.add(slot);
      }
    }
  }
  if(slots.size!==42||regularFirst!==11||projectFirst!==10)fail();
}

// In tests, supply exact bytes to challenge the same production read path.
export function verifyStudyBytes(specBytes,originalBytes){
  if(!Buffer.isBuffer(specBytes)||!Buffer.isBuffer(originalBytes))fail();
  const actualDigest=sha256(specBytes);
  if(actualDigest!==REGISTERED_V2_SHA256)fail();
  const spec=JSON.parse(specBytes);
  const blob=createHash('sha1').update('blob '+originalBytes.length+'\\0').update(originalBytes).digest('hex');
  if(blob!==ORIGINAL_BLOB||spec.originalFixtureGitBlobSha!==blob||
     spec.studyId!=='PP-0007-UI-PROSPECTIVE-V2'||spec.status!=='predeclared_not_executed'||
     spec.repetitionsPerCase!==3)fail();
  const original=JSON.parse(originalBytes);
  if(spec.caseDefinitions.length!==7||original.trials.length!==7)fail();
  for(let i=0;i<7;i++){
    const c=spec.caseDefinitions[i],o=original.trials[i];
    const prompt=o.canonicalObjective+(o.canonicalInputs===null?'':'\\nCanonical inputs (JSON): '+JSON.stringify(o.canonicalInputs));
    if(c.id!==o.id||c.submittedPrompt!==prompt||
       c.canonicalCapability!==o.canonicalCapability)fail();
  }
  validateSchedule(spec);
  return {spec,contractSha256:actualDigest,originalFixtureBlob:blob};
}

export async function loadStudy(){
  const [specBytes,originalBytes]=await Promise.all([readFile(SPEC),readFile(FROZEN)]);
  return verifyStudyBytes(specBytes,originalBytes);
}

function parse(argv){
  const flags=new Set(['--execute','--prepare','--capture']);
  const valued=new Set(['--case','--rep','--arm','--out','--sent','--response']);
  const args={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(Object.hasOwn(args,key)||(!flags.has(key)&&!valued.has(key)))fail();
    if(flags.has(key))args[key]=true;
    else {const value=argv[++i];if(!value||value.startsWith('--'))fail();args[key]=value;}
  }
  if(args['--execute']!==true||
     Number(args['--prepare']===true)+Number(args['--capture']===true)!==1||
     !/^[1-3]$/.test(args['--rep']??'')||
     !['regular','project'].includes(args['--arm'])||
     !isAbsolute(args['--out']??''))fail();
  if(args['--prepare']&&(args['--sent']!==undefined||args['--response']!==undefined))fail();
  if(args['--capture']&&(!isAbsolute(args['--sent']??'')||!isAbsolute(args['--response']??'')))fail();
  return args;
}

async function privateParent(path){
  if(!isAbsolute(path??''))fail();
  const parent=await realpath(dirname(resolve(path))),root=await realpath(ROOT);
  if(parent===root||parent.startsWith(root+sep))fail();
  const info=await stat(parent);
  if(!info.isDirectory()||(info.mode&0o077)!==0)fail();
  if(typeof process.getuid==='function'&&info.uid!==process.getuid())fail();
}

async function privateText(path,maxBytes){
  await privateParent(path);
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>maxBytes)fail();
  const bytes=await readFile(path);
  if(bytes.length!==info.size)fail();
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail();}
  if(!text.trim()||text.includes('\0'))fail();
  return {text,bytes};
}

export async function buildPacket({caseId,repetition,arm,sentPath=null,responsePath=null}){
  const {spec,contractSha256,originalFixtureBlob}=await loadStudy();
  const c=spec.caseDefinitions.find(x=>x.id===caseId);
  if(!c||!Number.isInteger(repetition)||repetition<1||repetition>3||
     !['regular','project'].includes(arm))fail();
  const order=spec.orderByCase[caseId]?.[repetition-1];
  if(!Array.isArray(order)||order.length!==2||order.indexOf(arm)<0)fail();
  const base={
    schemaVersion:1,studyId:spec.studyId,caseId,repetition,arm,
    positionInPair:order.indexOf(arm)+1,firstArm:order[0],
    contractSha256,originalFixtureBlob,
    expectedPromptSha256:sha256(Buffer.from(c.submittedPrompt,'utf8')),
    exactUserPrompt:c.submittedPrompt,
  };
  if(sentPath===null&&responsePath===null){
    return {...base,status:'not_collected',observedAnswer:null,providerAuthenticated:false,
      grade:null,taskComplete:null,latencyMs:null,providerReportedTokens:null};
  }
  if(!isAbsolute(sentPath??'')||!isAbsolute(responsePath??'')||
     resolve(sentPath)===resolve(responsePath))fail();
  const [sent,response]=await Promise.all([privateText(sentPath,16384),privateText(responsePath,262144)]);
  if(!sent.bytes.equals(Buffer.from(c.submittedPrompt,'utf8')))fail();
  return {...base,status:'operator_supplied_unverified',actualSubmittedPrompt:sent.text,
    actualPromptSha256:sha256(sent.bytes),promptParityVerified:true,
    observedAnswer:response.text,answerSha256:sha256(response.bytes),
    answerByteLength:response.bytes.length,capturedAt:new Date().toISOString(),
    providerAuthenticated:false,providerExportVerified:false,responseCompletenessVerified:false,
    originalConversationVerified:false,actualModel:null,actualToolGrants:null,
    actualToolCalls:null,grade:null,taskComplete:null,graderEvidence:null,
    latencyMs:null,providerReportedTokens:null,correctionTurns:null,
    githubReceiptVerified:null,sharedSoftwareTestsVerified:null,
    limitations:'Operator-supplied private text and local hashes do not authenticate a ChatGPT conversation, response completeness, timing, grades, source ZIPs, or provider activity.'};
}

export async function main(argv=process.argv.slice(2),log=console.log){
  const args=parse(argv);
  await privateParent(args['--out']);
  if(args['--capture']&&[args['--sent'],args['--response']].some(x=>resolve(x)===resolve(args['--out'])))fail();
  const packet=await buildPacket({
    caseId:args['--case'],repetition:Number(args['--rep']),arm:args['--arm'],
    sentPath:args['--capture']?args['--sent']:null,
    responsePath:args['--capture']?args['--response']:null,
  });
  const fd=await open(args['--out'],'wx',0o600);
  try{
    await fd.writeFile(JSON.stringify(packet,null,2)+'\n');
    await fd.sync();
    log(JSON.stringify({status:packet.status,studyId:packet.studyId,
      caseId:packet.caseId,repetition:packet.repetition,arm:packet.arm,
      providerAuthenticated:false,grade:null}));
    return packet;
  }finally{await fd.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  main().catch(()=>{console.log(JSON.stringify({status:'ui_v2_not_recorded'}));process.exitCode=1;});
}
