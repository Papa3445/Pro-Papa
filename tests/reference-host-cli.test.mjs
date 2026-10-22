import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/reference-host.mjs', import.meta.url));
async function call(args, input, env = {}) {
  const child = spawn(process.execPath, [cli, ...args], {
    stdio: ['pipe','pipe','pipe'],
    env: { ...process.env, GITHUB_TOKEN: '', PRO_PAPA_AUDIT_REPO: '', ...env },
  });
  let out='',error='';
  child.stdout.on('data',x=>{out+=x});
  child.stderr.on('data',x=>{error+=x});
  child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  const code=await new Promise((resolve,reject)=>{
    child.on('error',reject);
    child.on('close',resolve);
  });
  return { code, output:JSON.parse(out.trim()), error };
}
test('standalone Node reference host runs authorized real local math tool',async()=>{
  const x=await call([], {objective:'Add values',capability:'math.sum',inputs:{numbers:[3,4,5]}});
  assert.equal(x.code,0);
  assert.equal(x.output.status,'completed');
  assert.equal(x.output.execution.output.total,12);
  assert.equal(x.output.audit.status,'not_requested');
  assert.equal(x.error,'');
});
test('reference host sends unsupported request no actual provider execution',async()=>{
  const x=await call([], {objective:'Write a complete program',capability:'software'});
  assert.equal(x.code,1);
  assert.equal(x.output.status,'unsupported');
});
test('CLI audit fail closes with no token, never executes even local math',async()=>{
  const x=await call(['--audit-required'],{objective:'Add values',capability:'math.sum',
    inputs:{numbers:[5,8]}});
  assert.equal(x.code,1);
  assert.equal(x.output.status,'audit_failed');
  assert.equal(x.output.audit.status,'failed');
  assert.equal(x.output.execution,null);
});
test('malformed CLI request and flags do not echo sensitive prompts or tokens',async()=>{
  const secret='SENSITIVE-DO-NOT-LOG-584239';
  for(const args of [[],['--wrong',secret],['--github-repo']]) {
    const x=await call(args, secret);
    assert.equal(x.code,1);
    assert.equal(x.output.status,'invalid_request');
    assert.ok(!JSON.stringify(x).includes(secret), 'must not echo user data');
  }
});
test('effect approval flags cannot be used without explicit durable scope',async()=>{
  const x=await call(['--github-repo','Papa3445/Pro-Papa',
    '--approve-create-issue-id','8a0dc3bd-e94f-427a-a277-aaabf621047b',
    '--issue-repository','Papa3445/Pro-Papa'],
    {objective:'Create a GitHub issue',capability:'operations'});
  assert.equal(x.code,1);
  assert.equal(x.output.status,'invalid_request');
});
