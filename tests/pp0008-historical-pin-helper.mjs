// A deliberately narrow successor adapter for historical PP-0007 hash regressions.
// Reconstruct the immutable merged rev76 ledger, rather than weakening the hash
// check or rewriting any PP-0007 fixture. Reject all unrecognized revisions.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const CLOSURE_BLOB='c5bdf86ff43c6b6dcfe54563d187d86218ae3571';
const sha=x=>{
  const b=Buffer.from(x);
  return createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');
};
export function pp0007LedgerSnapshot(ledger){
  const current=sha(JSON.stringify(ledger,null,2)+'\n');
  if(current===CLOSURE_BLOB)return {isSuccessor:false,canonicalBlob:current};
  if(ledger.revision!==77||ledger.tasks.length!==13)throw Error('Unknown ledger mutation');
  const clone=structuredClone(ledger);
  const work=clone.tasks.find(t=>t.id==='PP-0008');
  if(work?.status!=='in_progress'||work.owner!=='chatgpt-implementation'||
     work.requiresTrustedReview!==true||
     work.reviewTarget?.repository!=='Papa3445/Pro-Papa'||
     work.reviewTarget?.pullRequest!==54||
     work.reviewTarget?.baseRef!=='main'||
     work.reviewTarget?.baseSha!=='45d49e7fd9f0c5ec136f0869c66e7c4c64de6e7b'||
     work.evidence.length!==0||
     work.blockedReason!==null)throw Error('Unexpected successor task transition');
  if(clone.tasks.filter(t=>t.status==='in_progress').length!==1||
     clone.tasks.find(t=>t.id==='PP-0007')?.status!=='verified'||
     clone.tasks.find(t=>t.id==='PP-0007')?.evidence?.length!==85||
     clone.tasks.some(t=>Number(t.id.split('-')[1])>=9&&t.status!=='pending'))
    throw Error('Historical tasks or dependencies changed');
  clone.revision=76;
  work.status='pending';work.owner=null;
  delete work.requiresTrustedReview;
  delete work.reviewTarget;
  const canonicalBlob=sha(JSON.stringify(clone,null,2)+'\n');
  if(canonicalBlob!==CLOSURE_BLOB)throw Error('PP-0007 historical canonical ledger bytes changed');
  return {isSuccessor:true,canonicalBlob};
}
export function currentLedgerSnapshot(){
  const value=JSON.parse(readFileSync(new URL('../.pro-papa/tasks.json',import.meta.url),'utf8'));
  return pp0007LedgerSnapshot(value);
}
