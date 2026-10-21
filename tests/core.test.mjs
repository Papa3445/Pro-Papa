import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeProject, loadProject, validateProject, selectNext, addTask, startTask,
  recordEvidence, closeTask, safeEvidenceFile, verifyClosure, blockTask, unblockTask,
  saveState, taskHandoff,
} from '../src/core.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pp-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, 'Test project');
  const project = await loadProject(root);
  return { root, ...project };
}

async function evidence(root, state, id, kind, actor, result = 'pass', filename = kind) {
  const file = join(root, `${filename}.txt`);
  await writeFile(file, `${kind} proof at ${filename}\n`);
  return recordEvidence(root, state, { id, kind, file, actor, result, note: `${kind} checked` });
}

test('initialization produces portable empty project, no destructive overwrite', async t => {
  const { root } = await fixture(t);
  assert.equal((await loadProject(root)).state.tasks.length, 0);
  assert.equal(JSON.parse(await readFile(join(root, '.pro-papa/adapter-policy.json'), 'utf8')).adapters.software.enabled, true);
  await assert.rejects(initializeProject(root, 'Overwrite'), /already exists/);
  assert.equal((await loadProject(root)).state.project, 'Test project');
});

test('dependency order, resume, blockers and scope', async t => {
  const { state, profiles } = await fixture(t);
  const a = addTask(state, profiles, { title: 'Research', objective: 'Review docs', profile: 'research', acceptance: ['Source audit'] });
  const b = addTask(state, profiles, { title: 'Build', objective: 'Build sample', profile: 'software', acceptance: ['Runs'], dependsOn: [a.id] });
  assert.equal(selectNext(state).id, a.id);
  assert.throws(() => startTask(state, b.id, 'agent'), /dependencies/);
  startTask(state, a.id, 'agent');
  assert.equal(selectNext(state).id, a.id);
  assert.throws(() => startTask(state, b.id, 'agent'), /dependencies|active/);
  blockTask(state, a.id, 'Needs credentials');
  assert.equal(selectNext(state), null);
  unblockTask(state, a.id);
  assert.equal(selectNext(state).id, a.id);
  assert.match(taskHandoff(a, profiles), /Research/);
});

test('cycle, duplicate dependency and invalid proof profile rejected', async t => {
  const { state, profiles } = await fixture(t);
  addTask(state, profiles, { title: 'A', objective: 'A', profile: 'general', acceptance: ['Ready'] });
  addTask(state, profiles, { title: 'B', objective: 'B', profile: 'general', acceptance: ['Ready'], dependsOn: ['PP-0001'] });
  state.tasks[0].dependsOn = ['PP-0002'];
  assert.throws(() => validateProject(state, profiles), /cycle/);
  state.tasks[0].dependsOn = [];
  profiles.profiles.general.requiredEvidence = ['artifact', 'review', 'review'];
  assert.throws(() => validateProject(state, profiles), /unique/);
});

test('cannot close with missing, failed or self-reviewed proof', async t => {
  const { root, state, profiles } = await fixture(t);
  const a = addTask(state, profiles, { title: 'A', objective: 'A', profile: 'general', acceptance: ['Works'] });
  startTask(state, a.id, 'implementer');
  await evidence(root, state, a.id, 'artifact', 'implementer');
  await assert.rejects(closeTask(root, state, profiles, a.id), /missing required evidence/);
  await evidence(root, state, a.id, 'validation', 'implementer', 'fail');
  await assert.rejects(recordEvidence(root, state, { id: a.id, kind: 'review', actor: 'implementer', note: 'self-review', file: 'artifact.txt' }), /reviewer must differ/);
  await evidence(root, state, a.id, 'review', 'other-person');
  await assert.rejects(closeTask(root, state, profiles, a.id), /latest validation proof failed/);
  await evidence(root, state, a.id, 'validation', 'implementer', 'pass', 'validation-fixed');
  await closeTask(root, state, profiles, a.id);
  assert.equal(a.status, 'verified');
});

test('changed evidence contents invalidate closure, no stale proof credit', async t => {
  const { root, state, profiles } = await fixture(t);
  const a = addTask(state, profiles, { title: 'A', objective: 'A', profile: 'general', acceptance: ['Works'] });
  startTask(state, a.id, 'agent');
  for (const kind of profiles.profiles.general.requiredEvidence) {
    await evidence(root, state, a.id, kind, kind === 'review' ? 'reviewer' : 'agent');
  }
  await writeFile(join(root, 'artifact.txt'), 'tampered');
  await assert.rejects(verifyClosure(root, a, profiles.profiles.general), /stale evidence file/);
});

test('symlink escape from project is refused', async t => {
  const { root } = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'pp-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const target = join(outside, 'evidence.txt');
  await writeFile(target, 'untrusted');
  await symlink(target, join(root, 'escape.txt'));
  await assert.rejects(safeEvidenceFile(root, 'escape.txt'), /inside project root/);
});

test('state save and reload persists task progress and evidence integrity', async t => {
  const { root, state, profiles } = await fixture(t);
  const a = addTask(state, profiles, { title: 'Write', objective: 'Create artifact', profile: 'general', acceptance: ['Reviewed'] });
  startTask(state, a.id, 'writer');
  for (const kind of profiles.profiles.general.requiredEvidence) {
    await evidence(root, state, a.id, kind, kind === 'review' ? 'critic' : 'writer');
  }
  await closeTask(root, state, profiles, a.id);
  await saveState(root, state, profiles);
  const loaded = await loadProject(root);
  assert.equal(loaded.state.tasks[0].status, 'verified');
  assert.equal(loaded.state.tasks[0].evidence.length, 3);
});

test('optimistic revision blocks a stale writer from overwriting newer task state', async t => {
  const { root } = await fixture(t);
  const original = await loadProject(root);
  const stale = await loadProject(root);
  addTask(original.state, original.profiles, { title: 'First', objective: 'First', profile: 'general', acceptance: ['Passes'] });
  await saveState(root, original.state, original.profiles);
  addTask(stale.state, stale.profiles, { title: 'Second', objective: 'Second', profile: 'general', acceptance: ['Passes'] });
  await assert.rejects(saveState(root, stale.state, stale.profiles), /stale writer/);
  assert.equal((await loadProject(root)).state.tasks[0].title, 'First');
});

test('init --guide does not partially initialize when AGENTS.md exists', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pp-existing-guide-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'AGENTS.md'), 'existing rules');
  await assert.rejects(initializeProject(root, 'Project', { agentGuide: true }), /already exists/);
  await assert.rejects(readFile(join(root, '.pro-papa/tasks.json')), /ENOENT/);
  assert.equal(await readFile(join(root, 'AGENTS.md'), 'utf8'), 'existing rules');
});

test('an edited verified state cannot omit proof of completion', async t => {
  const { state, profiles } = await fixture(t);
  const a = addTask(state, profiles, { title: 'A', objective: 'A', profile: 'general', acceptance: ['Works'] });
  a.status = 'verified';
  a.verifiedAt = new Date().toISOString();
  assert.throws(() => validateProject(state, profiles), /verified without passing/);
});
