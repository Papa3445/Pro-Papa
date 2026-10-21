import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  const task = JSON.parse(run(['add', ...opts, '--title', 'A report', '--objective', 'Explain a subject', '--profile', 'research', '--accept', 'Evidence based']));
  assert.equal(JSON.parse(run(['next', ...opts])).id, task.id);
  assert.equal(JSON.parse(run(['start', ...opts, '--id', task.id, '--actor', 'writer'])).status, 'in_progress');
  assert.match(run(['handoff', ...opts, '--id', task.id]), /sources/);
  for (const kind of ['artifact', 'sources', 'validation', 'review']) {
    const file = join(root, `${kind}.md`);
    await writeFile(file, `Proof for ${kind}`);
    const actor = kind === 'review' ? 'independent-critic' : 'writer';
    assert.equal(JSON.parse(run(['proof', ...opts, '--id', task.id, '--kind', kind, '--file', file, '--actor', actor, '--note', 'Observed result'])).result, 'pass');
  }
  assert.equal(JSON.parse(run(['close', ...opts, '--id', task.id])).verifiedFiles.length, 4);
  assert.equal(JSON.parse(run(['status', ...opts])).tasks[0].status, 'verified');
  assert.equal(JSON.parse(run(['validate', ...opts])).valid, true);
});

test('CLI refuses out-of-order flags and unrecognized command', () => {
  assert.throws(() => run(['nope']), /Command failed/);
  assert.throws(() => run(['add', '--title']), /Command failed/);
});
