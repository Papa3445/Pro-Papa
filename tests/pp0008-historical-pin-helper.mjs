// A deliberately narrow successor adapter for historical PP-0007 hash regressions.
// Reconstruct the immutable merged rev76 ledger, rather than weakening the hash
// check or rewriting any PP-0007 fixture. Reject all unrecognized revisions.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const CLOSURE_BLOB='c5bdf86ff43c6b6dcfe54563d187d86218ae3571';
const PP0008_BASELINE_BLOB='597863d867e8d92265f16bd079d15481f0de1ba8';
const PP0008_EVIDENCE_BLOB='7918b1ba47566380c72e3f3d25d549d54ae502f3';
const PP0008_CLOSED_BLOB='38f2ead075ef78da59a4256ad2074eabe062cda5';
const PP0009_ACTIVE_BLOB='9994453d3789ca87c3e29e0a2c8f43571f6f3043';
const sha=x=>{
  const b=Buffer.from(x);
  return createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex');
};
export function pp0007LedgerSnapshot(ledger){
  if(ledger.revision===84){
    // Undo only four actual CLI-recorded source-backed proofs. Pin the exact
    // protected rev80 ledger rather than permitting arbitrary task mutations.
    const prior=structuredClone(ledger);
    const task=prior.tasks.find(x=>x.id==='PP-0009');
    const specs=[
      ['artifact','.pro-papa/evidence/PP-0009/production-oauth-smoke-2026-10-28.json','a31e7f5de4fb394353e074fdfcb0c7c92cabdafe8e5ae562a384c4eb17105f2e','chatgpt-implementation'],
      ['test','.pro-papa/evidence/PP-0009/ci-and-adversarial-results-2026-10-28.json','58e568fb318d267914db73c964b76ac55a68ffe18ebda6fa653d3a121aac8264','chatgpt-implementation'],
      ['validation','.pro-papa/evidence/PP-0009/production-validation-and-retention-2026-10-28.json','b3ac4cdc6d93a139360936daddc48105accfd02206db64511bf9fa5f6bfc393e','chatgpt-implementation'],
      ['review','.pro-papa/evidence/PP-0009/independent-github-reviews-2026-10-28.json','50a0eb5b7060e138f5d1a79ac8fd7ba586e72e58f25daceefcbf3c8645e79046','papa4568']
    ];
    if(ledger.tasks.length!==13||task?.status!=='in_progress'||
       task.evidence?.length!==4||task.evidence.some((e,i)=>
         e.kind!==specs[i][0]||e.path!==specs[i][1]||
         e.sha256!==specs[i][2]||e.actor!==specs[i][3]||
         e.result!=='pass'||typeof e.note!=='string'||!e.note.trim()||
         !Number.isFinite(Date.parse(e.recordedAt))))
      throw Error('Unknown PP-0009 evidence registration');
    task.evidence=[];
    prior.revision=80;
    if(sha(JSON.stringify(prior,null,2)+'\n')!==PP0009_ACTIVE_BLOB)
      throw Error('PP-0009 proof registration altered historical protected ledger');
    return pp0007LedgerSnapshot(prior);
  }
  // PP-0009: normalize exactly one ready-task start, WITHOUT re-pinning
  // rev79 or mutating historical PP-0007 / PP-0008 evidence.
  if(ledger.revision===80){
    const prior=structuredClone(ledger);
    const task=prior.tasks.find(x=>x.id==='PP-0009');
    if(ledger.tasks.length!==13||task?.status!=='in_progress'||
       task.owner!=='chatgpt-implementation'||task.blockedReason!==null||
       task.evidence?.length!==0||task.requiresTrustedReview!==true||
       task.reviewTarget?.repository!=='Papa3445/Pro-Papa'||
       task.reviewTarget?.pullRequest!==59||
       task.reviewTarget?.baseRef!=='main'||
       task.reviewTarget?.baseSha!=='c5c2c485efac1633ba296aa72588ad9a1544b169')
      throw Error('PP-0009 unexpected start transition');
    task.status='pending';task.owner=null;
    delete task.requiresTrustedReview;delete task.reviewTarget;
    prior.revision=79;
    if(sha(JSON.stringify(prior,null,2)+'\n')!==PP0008_CLOSED_BLOB)
      throw Error('PP-0009 start did not preserve exact verified PP-0008 baseline');
    return pp0007LedgerSnapshot(prior);
  }
  const current=sha(JSON.stringify(ledger,null,2)+'\n');
  if(current===CLOSURE_BLOB)return {isSuccessor:false,canonicalBlob:current};
  if(![77,78,79].includes(ledger.revision)||ledger.tasks.length!==13)throw Error('Unknown ledger mutation');
  const clone=structuredClone(ledger);
  const work=clone.tasks.find(t=>t.id==='PP-0008');
  if(ledger.revision===79){
    // A reviewed candidate verified transition is allowed only when undoing
    // that ONE status/time mutation reproduces the exact merged rev78 ledger.
    if(work?.status!=='verified'||typeof work.verifiedAt!=='string'||
       !Number.isFinite(Date.parse(work.verifiedAt)))
      throw Error('Unverified PP-0008 closeout transition');
    work.status='in_progress';
    delete work.verifiedAt;
    clone.revision=78;
    if(sha(JSON.stringify(clone,null,2)+'\n')!==PP0008_EVIDENCE_BLOB)
      throw Error('PP-0008 exact merged evidence baseline changed');
    clone.revision=79;
  }
  if(work?.status!=='in_progress'||work.owner!=='chatgpt-implementation'||
     work.requiresTrustedReview!==true||
     work.reviewTarget?.repository!=='Papa3445/Pro-Papa'||
     work.reviewTarget?.baseRef!=='main'||
     work.blockedReason!==null)throw Error('Unexpected successor task transition');
  if(ledger.revision>=78){
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
    // Use the already reverted verified→in_progress clone, not rev79 input.
    const baseline=structuredClone(clone);
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
