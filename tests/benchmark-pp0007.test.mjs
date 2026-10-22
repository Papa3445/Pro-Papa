import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, runBenchmark } from '../bin/benchmark-pp0007.mjs';

test('PP-0007 pilot has six required categories plus novel fallback',async()=>{
  assert.equal(CASES.length,7);
  const categories=CASES.map(x=>x.category);
  for(const category of ['quick Q&A','sourced research','software',
    'document creation','calculation/data analysis','planning/operations',
    'novel/fallback']) assert.ok(categories.includes(category));
});

test('PP-0007 synthetic provider pilot does not fabricate cross-domain completion',async()=>{
  const report=await runBenchmark();
  assert.equal(report.mode,'deterministic_fake_github');
  assert.equal(report.pilotCount,7);
  assert.equal(report.successfulUserTasks,2);
  assert.equal(report.safelyUnsupported,5);
  assert.equal(report.userTaskCompletionRate,Math.round(2/7*1000)/1000);
  assert.equal(report.testExpectationPassRate,1);
  assert.equal(report.guardrailsPassed,true);
  assert.equal(report.totalGitHubCallsObserved,1);
  assert.equal(report.requestsToUnapprovedEndpoints,0);
  assert.equal(report.receiptCount,0);
  assert.equal(report.persistedTaskCount,1);
  assert.equal(report.durableProbe.valid,true);
  assert.equal(report.durableProbe.retryStatus,'already_executed');
  assert.equal(report.durableProbe.storedRunState,'completed');
  assert.equal(report.tokenUsage,null);
  assert.equal(report.directAssistantBaseline,null);
  assert.ok(report.baselineReason.includes('No comparable direct LLM'));
  assert.equal(report.pilots.find(x=>x.id==='data').outputSummary.total,10);
  assert.equal(report.pilots.find(x=>x.id==='research').provenanceProvider,'github');
  assert.equal(report.pilots.find(x=>x.id==='qa').status,'unsupported');
  assert.equal(report.pilots.find(x=>x.id==='software').status,'unsupported');
  assert.equal(report.pilots.find(x=>x.id==='document').status,'unsupported');
  assert.equal(report.pilots.find(x=>x.id==='planning').status,'denied');
  assert.equal(report.pilots.find(x=>x.id==='novel').status,'unsupported');
  assert.deepEqual(report.negatives.map(x=>x.passed),[true,true,true,true]);
  assert.ok(report.pilots.every(x=>x.elapsedMs>=0 && Number.isFinite(x.elapsedMs)));
});
test('PP-0007 live-mode transport can be exercised with a source-verified stub without claiming real network',async()=>{
  let calls=0;
  const fetchImpl=async(url,options)=>{
    calls++;
    assert.equal(url,'https://api.github.com/repos/Papa3445/Pro-Papa');
    assert.equal(options.method,'GET');
    return {ok:true,status:200,json:async()=>({
      full_name:'Papa3445/Pro-Papa',id:1427703038,private:false,
      html_url:'https://github.com/Papa3445/Pro-Papa',
      description:'safe fixture',stargazers_count:100,open_issues_count:12,
    })};
  };
  const report=await runBenchmark({liveResearch:true,fetchImpl});
  assert.equal(report.mode,'injected_read_only_github_transport');
  assert.equal(calls,1);
  assert.equal(report.totalGitHubCallsObserved,1);
  assert.equal(report.requestsToUnapprovedEndpoints,0);
  assert.equal(report.guardrailsPassed,true);
  assert.equal(report.successfulUserTasks,2);
  // Injected fetch proves host behavior, not a native live provider read.
  // A real GitHub GET must be evidenced by a separate provider run.
});
