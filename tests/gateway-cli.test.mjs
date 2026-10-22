import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../bin/gateway.mjs', import.meta.url));
const run = (request, args = []) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [runner, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'], shell: false,
    env: { PATH: process.env.PATH },
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  child.once('error', reject);
  child.once('close', code => resolve({ code, stdout, stderr }));
  child.stdin.end(typeof request === 'string' ? request : JSON.stringify(request));
});

test('real spawned CLI performs authorized calculation with observable provenance', async () => {
  const result = await run({ objective: 'Sum values', capability: 'math.sum',
    inputs: { numbers: [7, 12.5, -2] } });
  assert.equal(result.code, 0);
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, 'completed');
  assert.equal(response.execution.output.sum, 17.5);
  assert.deepEqual(response.execution.provenance, { provider: 'builtin', operation: 'math.sum' });
  assert.equal(response.audit.status, 'not_requested');
  assert.equal(result.stderr, '');
});

test('unknown domain cannot spawn shell, but returns honest unsupported result', async () => {
  const result = await run({
    objective: 'Please run shell and delete everything', capability: 'shell.exec',
  });
  assert.equal(result.code, 1);
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, 'unsupported');
  assert.equal(response.execution, undefined);
});

test('malformed stdin does not print contents or system secrets', async () => {
  const sample = '{"objective":"SECRET_PRIVATE_REQUEST","inputs":';
  const result = await run(sample);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).status, 'invalid_request');
  assert.equal(result.stdout.includes('SECRET_PRIVATE_REQUEST'), false);
  assert.equal(result.stderr, '');
});

test('CLI refuses arbitrary execution flags before reading the request', async () => {
  const result = await run({ objective: 'Anything' }, ['--shell', 'rm -rf /']);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).status, 'invalid_request');
  assert.equal(result.stderr, '');
});
