import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const cli = resolve('bin/pro-papa.mjs');
function run(args, cwd = process.cwd()) { return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }).trim(); }

test('CLI init, add, select, start, record, close and status', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pp-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const opts = ['--root', root];
  assert.equal(JSON.parse(run(['init', '--name', 'General purpose', ...opts])).created, true);
  const task = JSON.parse(run(['add', ...opts, '--title', 'A report', '--objective', 'Explain a subject', '--profile', 'general', '--accept', 'Evidence based']));
  assert.equal(JSON.parse(run(['next', ...opts])).id, task.id);
  assert.equal(JSON.parse(run(['start', ...opts, '--id', task.id, '--actor', 'writer'])).status, 'in_progress');
  assert.match(run(['handoff', ...opts, '--id', task.id]), /validation/);
  for (const kind of ['artifact', 'validation', 'review']) {
    const file = join(root, `${kind}.md`);
    await writeFile(file, `Proof for ${kind}`);
    const actor = kind === 'review' ? 'independent-critic' : 'writer';
    assert.equal(JSON.parse(run(['proof', ...opts, '--id', task.id, '--kind', kind, '--file', file, '--actor', actor, '--note', 'Observed result'])).result, 'pass');
  }
  assert.equal(JSON.parse(run(['close', ...opts, '--id', task.id])).verifiedFiles.length, 3);
  assert.equal(JSON.parse(run(['status', ...opts])).tasks[0].status, 'verified');
  assert.equal(JSON.parse(run(['validate', ...opts])).valid, true);
});

test('CLI refuses out-of-order flags and unrecognized command', () => {
  assert.throws(() => run(['nope']), /Command failed/);
  assert.throws(() => run(['add', '--title']), /Command failed/);
});

test('CLI adapter-check records truthful failing proof and exits nonzero', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pp-adapter-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const opts = ['--root', root];
  run(['init', ...opts, '--name', 'Adapter cli test']);
  const task = JSON.parse(run(['add', ...opts, '--title', 'Build', '--objective', 'Check syntax', '--profile', 'software', '--accept', 'Syntax check']));
  run(['start', ...opts, '--id', task.id, '--actor', 'agent']);
  await writeFile(join(root, 'valid.mjs'), 'export const x = 42;');
  const good = JSON.parse(run(['adapter-check', ...opts, '--id', task.id, '--file', 'valid.mjs', '--actor', 'agent']));
  assert.equal(good.report.result, 'pass');
  assert.equal(good.proof.kind, 'adapter');
  assert.match(good.reportFile, /^\.pro-papa\/evidence\//);
  await writeFile(join(root, 'bad.mjs'), 'const = ;');
  assert.throws(() => run(['adapter-check', ...opts, '--id', task.id, '--file', 'bad.mjs', '--actor', 'agent']), /Command failed/);
  const contents = JSON.parse(await readFile(join(root, '.pro-papa/tasks.json'), 'utf8'));
  assert.equal(contents.tasks[0].evidence.at(-1).result, 'fail');
  assert.equal(contents.tasks[0].status, 'in_progress');
});


test('CLI cannot replace an adapter failure with a fake manual passing proof', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pp-cli-spoof-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const opts = ['--root', root];
  run(['init', '--name', 'Negative adapter evidence', ...opts]);
  const task = JSON.parse(run(['add', ...opts, '--title', 'Reject fake', '--objective', 'Proof quality', '--profile', 'software', '--accept', 'Do not fake']));
  run(['start', ...opts, '--id', task.id, '--actor', 'agent']);
  await writeFile(join(root, 'broken.mjs'), 'const = ;');
  assert.throws(() => run(['adapter-check', ...opts, '--id', task.id, '--file', 'broken.mjs', '--actor', 'agent']), /Command failed/);
  await writeFile(join(root, 'trust-me.txt'), 'PASS');
  assert.throws(() => run(['proof', ...opts, '--id', task.id, '--kind', 'adapter', '--result', 'pass', '--file', 'trust-me.txt', '--actor', 'agent', '--note', 'PASS']), /Command failed/);
  // Recording a legitimate runtime-test report remains permitted.
  assert.equal(JSON.parse(run(['proof', ...opts, '--id', task.id, '--kind', 'test', '--result', 'pass', '--file', 'trust-me.txt', '--actor', 'agent', '--note', 'Runtime test evidence'])).kind, 'test');
  const current = JSON.parse(await readFile(join(root, '.pro-papa/tasks.json'), 'utf8'));
  assert.equal(current.tasks[0].evidence.findLast(item => item.kind === 'adapter').result, 'fail');
});
