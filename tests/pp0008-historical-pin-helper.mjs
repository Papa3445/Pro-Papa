// A deliberately narrow successor adapter for historical PP-0007 hash regressions.
// Reconstruct the immutable merged rev76 ledger, rather than weakening the hash
// check or rewriting any PP-0007 fixture. Reject all unrecognized revisions.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const CLOSURE_BLOB='c5bdf86ff43c6b6dcfe54563d187d86218ae3571';
const PP0008_BASELINE_BLOB='597863d867e8d92265f16bd079d15481f0de1ba8';
const sha=x=>{
  const b=Buffer.from(x);
  return createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');
};
export function pp0007LedgerSnapshot(ledger){
  const current=sha(JSON.stringify(ledger,null,2)+'\n');
  if(current===CLOSURE_BLOB)return {isSuccessor:false,canonicalBlob:current};
  if(![77,78].includes(ledger.revision)||ledger.tasks.length!==13)throw Error('Unknown ledger mutation');
  const clone=structuredClone(ledger);
  const work=clone.tasks.find(t=>t.id==='PP-0008');
  if(work?.status!=='in_progress'||work.owner!=='chatgpt-implementation'||
     work.requiresTrustedReview!==true||
     work.reviewTarget?.repository!=='Papa3445/Pro-Papa'||
     work.reviewTarget?.baseRef!=='main'||
     work.blockedReason!==null)throw Error('Unexpected successor task transition');
  if(ledger.revision===78){
    if(work.reviewTarget?.pullRequest!==55||
       work.reviewTarget?.baseSha!=='17d5887b6be61cda5de3508807cf404f1cd391f3')
      throw Error('Evidence closeout reviewTarget must pin approved PR #55 base');
    const proofs=[
      ['artifact','native-connected-live-acceptance-2026-10-27.json','24f343651d7cce587d36c40289a04fcb9d3de45d57846e76fb5716e7a457b9e1'],
      ['test','live-oauth-mcp-smoke-2026-10-27.json','1f8fb9de7aa5b12c2ab87416ed23a758000ad6097a71469c6caa0d471583a0db'],
      ['validation','byte-identity-and-production-restoration-2026-10-27.json','962fb24f0ed50213d5495827260d75a273a298162263a8e1972774701aa9a8d9'],
      ['review','independent-implementation-review-2026-10-27.json','0a2598824e86debce93338d38300aee6b38fdd83a598e608cf09d8fa7028c379']
    ];
    if(work.evidence.length!==proofs.length||work.evidence.some((e,i)=>
      e.kind!==proofs[i][0]||
      e.path!=='.pro-papa/evidence/PP-0008/'+proofs[i][1]||
      e.sha256!==proofs[i][2]||e.result!=='pass'||
      e.actor!==(e.kind==='review'?'papa4568':'chatgpt-implementation')||
      typeof e.note!=='string'||!e.note.trim()||
      !Number.isFinite(Date.parse(e.recordedAt))))
      throw Error('Unrecognized PP-0008 evidence transition');
    const baseline=structuredClone(ledger);
    baseline.revision=77;
    const oldTask=baseline.tasks.find(t=>t.id==='PP-0008');
    oldTask.evidence=[];
    oldTask.reviewTarget={repository:'Papa3445/Pro-Papa',pullRequest:54,
      baseRef:'main',baseSha:'45d49e7fd9f0c5ec136f0869c66e7c4c64de6e7b'};
    if(sha(JSON.stringify(baseline,null,2)+'\n')!==PP0008_BASELINE_BLOB)
      throw Error('PP-0008 merged baseline ledger mutated');
    work.evidence=[];
    work.reviewTarget={repository:'Papa3445/Pro-Papa',pullRequest:54,
      baseRef:'main',baseSha:'45d49e7fd9f0c5ec136f0869c66e7c4c64de6e7b'};
  }else if(work.evidence.length!==0||work.reviewTarget?.pullRequest!==54||
           work.reviewTarget?.baseSha!=='45d49e7fd9f0c5ec136f0869c66e7c4c64de6e7b')
    throw Error('Unexpected PP-0008 baseline evidence or review target');
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
