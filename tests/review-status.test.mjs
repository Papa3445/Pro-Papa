import test from 'node:test';
import assert from 'node:assert/strict';
import { publishOneReviewStatus, publishForBaseBranch, PIN_CONTEXT, REVIEW_CONTEXT } from '../src/review-status.mjs';

const repo='Papa3445/Pro-Papa', head='a'.repeat(40), base='b'.repeat(40), newer='c'.repeat(40);
const date='2026-10-21T03:00:00Z';
const pull=(sha=base)=>({number:2,head:{sha:head},base:{ref:'main',sha,repo:{full_name:repo}},user:{id:22,login:'author'}});
const approval=(at='2026-10-21T03:10:00Z')=>({id:301,state:'APPROVED',commit_id:head,submitted_at:at,user:{id:33,login:'reviewer'}});
const baseline={id:100,context:PIN_CONTEXT,creator:{id:41898282,login:'github-actions[bot]'},
  state:'pending',description:'base-ref=main;base-sha='+base,created_at:date};
function mock({pr=pull(),pin=baseline,reviews=[approval()],list=[pull()],pinReturned=true}={}) {
  const posts=[],calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,method:options.method});
    const path=new URL(url).pathname,query=new URL(url).searchParams;
    let data;
    if(options.method==='POST') {
      data=JSON.parse(options.body); posts.push({path,...data});
      if(data.context===PIN_CONTEXT) data={...baseline,description:data.description};
      else data={id:999,context:data.context,state:data.state};
    } else if(path.endsWith('/pulls/2/reviews')) data=reviews;
    else if(path.endsWith('/pulls/2')) data=pr;
    else if(path.endsWith('/statuses') && options.method==='GET')data=pin ? [pin] : [];
    else if(path.endsWith('/pulls') && query.has('base')) data=list;
    else throw Error('Unexpected mock path '+path);
    return {ok:true,status:200,json:async()=>data};
  };
  return {fetchImpl,posts,calls};
}
const opts=f=>({token:'test-token',fetchImpl:f.fetchImpl});
test('GitHub-recorded base pin and subsequent independent approval produce strict PASS',async()=>{
  const f=mock(),r=await publishOneReviewStatus(repo,2,opts(f));
  assert.equal(r.verdict,'PASS');assert.equal(f.posts.at(-1).context,REVIEW_CONTEXT);
  assert.equal(f.posts.at(-1).state,'success');assert.equal(r.baseSha,base);
});
test('base advance before first PR read fails despite unchanged head and approval',async()=>{
  const f=mock({pr:pull(newer)}),r=await publishOneReviewStatus(repo,2,opts(f));
  assert.equal(r.verdict,'FAIL');assert.match(r.reason,/pinned review target/);
  assert.equal(f.posts.at(-1).state,'failure');
});
test('cannot replace original base pin to revalidate old approval',async()=>{
  const f=mock({pr:pull(newer),pin:{...baseline}}),r=await publishOneReviewStatus(repo,2,{...opts(f),allowInitialPin:true});
  assert.equal(r.verdict,'FAIL');assert.equal(f.posts.filter(x=>x.context===PIN_CONTEXT).length,0);
});
test('untrusted or absent pin always fails rather than falling back to head-only',async()=>{
  for(const pin of [null,{...baseline,creator:{id:9,login:'other'}},{...baseline,state:'success'}]) {
    const f=mock({pin}),r=await publishOneReviewStatus(repo,2,opts(f));
    assert.equal(r.verdict,'FAIL');assert.equal(f.posts.at(-1).state,'failure');
  }
});
test('only new-head initialization may anchor pin, and pre-pin approval is stale',async()=>{
  const f=mock({pin:null});
  const r=await publishOneReviewStatus(repo,2,{...opts(f),allowInitialPin:true});
  assert.equal(r.verdict,'PASS');assert.equal(f.posts[0].context,PIN_CONTEXT);
  const old=mock({pin:null,reviews:[approval('2026-10-20T00:00:00Z')]});
  const x=await publishOneReviewStatus(repo,2,{...opts(old),allowInitialPin:true});
  assert.equal(x.verdict,'FAIL');assert.match(x.reason,/predates trusted baseline/);
});
test('base push scans open PRs and reports failure on their existing head SHA',async()=>{
  const f=mock({pr:pull(newer)});
  const r=await publishForBaseBranch(repo,'main',opts(f));
  assert.equal(r.length,1);assert.equal(r[0].verdict,'FAIL');
  assert.equal(f.posts.at(-1).path,'/repos/Papa3445/Pro-Papa/statuses/'+head);
});
test('review event cannot initialize a pin for an already existing SHA',async()=>{
  const f=mock({pin:null}),r=await publishOneReviewStatus(repo,2,{...opts(f),allowInitialPin:false});
  assert.equal(r.verdict,'FAIL');assert.equal(f.posts.length,1);
  assert.equal(f.posts[0].context,REVIEW_CONTEXT);
});
