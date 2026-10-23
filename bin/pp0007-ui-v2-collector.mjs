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
const fail=()=>{throw Error('Invalid PP-0007 UI-v2 collection operation')};
const sha256=data=>createHash('sha256').update(data).digest('hex');

export async function loadStudy(){
  const [specBytes,originalBytes]=await Promise.all([readFile(SPEC),readFile(FROZEN)]);
  const spec=JSON.parse(specBytes);
  const blob=createHash('sha1').update('blob '+originalBytes.length+'\0').update(originalBytes).digest('hex');
  if(blob!==ORIGINAL_BLOB||spec.originalFixtureGitBlobSha!==blob||
     spec.studyId!=='PP-0007-UI-PROSPECTIVE-V2'||spec.status!=='predeclared_not_executed'||
     spec.repetitionsPerCase!==3)fail();
  const original=JSON.parse(originalBytes);
  if(spec.caseDefinitions.length!==7||original.trials.length!==7)fail();
  for(let i=0;i<7;i++){
    const c=spec.caseDefinitions[i],o=original.trials[i];
    const prompt=o.canonicalObjective+(o.canonicalInputs===null?'':'\nCanonical inputs (JSON): '+JSON.stringify(o.canonicalInputs));
    if(c.id!==o.id||c.submittedPrompt!==prompt||
       c.canonicalCapability!==o.canonicalCapability)fail();
  }
  return {spec,contractSha256:sha256(specBytes),originalFixtureBlob:blob};
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
