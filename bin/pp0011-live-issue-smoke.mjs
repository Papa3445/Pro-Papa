#!/usr/bin/env node
// PP-0011 opt-in *live* public-GitHub GET, from the unmodified standalone CLI.
// No credentials, deployment, issue writes, environment-derived permissions or
// persistence; do not present this as staging/production capability validation.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

const repo='Papa3445/Pro-Papa',issueNumber=37;
const source='https://github.com/'+repo+'/issues/'+issueNumber;
const cli=fileURLToPath(new URL('./reference-host.mjs',import.meta.url));
const request={
  objective:'Read public issue #37 for bounded source-backed research acceptance',
  capability:'research.issue',
  inputs:{repository:repo,issueNumber},
};
// Permit only the system program path and locale; never pass GitHub tokens or
// user-provided provider URLs into either subprocess.
const cleanEnv={PATH:process.env.PATH??'/usr/bin:/bin',LANG:'C.UTF-8'};
function invoke(flags,body=request){
  const child=spawnSync(process.execPath,[cli,'--enforce-trace',...flags],{
    input:JSON.stringify(body),encoding:'utf8',timeout:25000,maxBuffer:65536,
    env:cleanEnv,
  });
  assert.equal(child.error,undefined,'CLI must launch without process error');
  assert.equal(child.stderr,'','CLI must not disclose internal errors');
  assert.ok(child.stdout.length<16000,'CLI response must remain bounded');
  return {exitCode:child.status,reply:JSON.parse(child.stdout)};
}
function blocked(out){
  assert.equal(out.exitCode,1,'Denied host must exit nonzero');
  assert.equal(out.reply.status,'denied');
  assert.equal(out.reply.execution,null);
  assert.equal(out.reply.trace.state,'not_released');
  assert.equal(verifyReleasedExecution(out.reply),false);
}
try {
  // Negative: omission of trusted --github-read cannot be bypassed by payload.
  blocked(invoke(['--github-repo',repo],{
    ...request,grants:['research.issue'],githubResearch:true,
    allowedRepositories:[repo],
  }));
  // Negative: trusted grant restricted to our repository, no provider call.
  const wrong=invoke(['--github-read','--github-repo',repo],{
    ...request,inputs:{repository:'unapproved/repository',issueNumber},
  });
  assert.equal(wrong.exitCode,1);
  assert.equal(wrong.reply.status,'provider_unavailable');
  assert.equal(wrong.reply.execution,null);
  assert.equal(wrong.reply.trace.state,'not_released');

  // Positive: actual CLI executes a single public GitHub provider request.
  const actual=invoke(['--github-read','--github-repo',repo]);
  assert.equal(actual.exitCode,0,
    'Live GitHub read was unavailable: no successful provider result is claimed');
  const r=actual.reply;
  assert.equal(r.status,'completed');
  assert.equal(r.capability,'research.issue');
  assert.equal(r.trace.state,'released');
  assert.equal(verifyReleasedExecution(r),true);
  assert.equal(r.trace.provider,'github');
  assert.equal(r.trace.dispatchedCapability,'research.issue');
  assert.equal(r.trace.providerAuthenticated,false);
  assert.equal(r.audit.status,'not_requested');
  assert.deepEqual(r.execution.provenance,{
    provider:'github',operation:'research.issue',
    reference:'issue:papa3445/pro-papa:37',
  });
  const x=r.execution.output;
  assert.equal(x.repository,repo);
  assert.equal(x.issueNumber,issueNumber);
  assert.equal(x.url,source);
  assert.ok(typeof x.title==='string'&&x.title.length>0&&x.title.length<=256);
  assert.ok(['open','closed'].includes(x.state));
  assert.match(x.updatedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.ok(typeof x.bodyExcerpt==='string'&&x.bodyExcerpt.length<=1200);
  assert.match(x.limitations,/untrusted source text/);

  console.log('PP0011_LIVE_ISSUE_RESEARCH '+JSON.stringify({
    result:'completed',sourceRef:process.env.GITHUB_SHA??null,
    operatorQualityAcceptance:null,productionDeployment:null,
    provider:'github',providerAuthenticated:false,
    capability:r.capability,sourceUrl:x.url,title:x.title,state:x.state,
    updatedAt:x.updatedAt,bodyExcerptUntrusted:x.bodyExcerpt,
    truncated:x.bodyTruncated,traceState:r.trace.state,
    releasedExecutionSha256:r.trace.executionSha256,
    negativeChecks:{ungranted:'denied',wrongRepository:'provider_unavailable'},
    limitations:'Public live provider GET from a GitHub Actions runner via the standalone CLI; not a deployed Vercel/Netlify host, native ChatGPT routing, research synthesis or production rollback.',
  }));
} catch {
  // Failed or unavailable provider traffic is not silently graded successful.
  console.error('PP0011_LIVE_ISSUE_RESEARCH_FAILED: no verified live host release');
  process.exitCode=1;
}
