import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, realpath, stat, open, rm, access } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';

const STATUSES = new Set(['pending', 'in_progress', 'blocked', 'verified']);
const PROOF_TYPES = new Set(['artifact', 'test', 'validation', 'review', 'sources', 'calculations']);
export const BUILTIN_PROOF_KINDS = Object.freeze({ software: 'test', research: 'sources', document: 'validation' });
const SAFE_ID = /^PP-[0-9]{4,}$/;
const fail = message => { throw new Error(message); };
const assert = (truth, message) => { if (!truth) fail(message); };
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uniqueStrings = (list, label, allowEmpty = false) => {
  assert(Array.isArray(list) && (allowEmpty || list.length > 0), `${label} must be a nonempty array`);
  assert(list.every(nonEmpty) && new Set(list).size === list.length, `${label} needs unique nonempty strings`);
};

export async function loadProject(root) {
  const directory = resolve(root);
  const [state, profiles] = await Promise.all([
    readFile(resolve(directory, '.pro-papa/tasks.json'), 'utf8').then(JSON.parse),
    readFile(resolve(directory, '.pro-papa/profiles.json'), 'utf8').then(JSON.parse),
  ]);
  validateProject(state, profiles);
  return { root: directory, state, profiles };
}

export function validateProject(state, profiles) {
  assert(plain(state) && state.schemaVersion === 1 && nonEmpty(state.project) && Number.isSafeInteger(state.revision) && state.revision >= 0 && Array.isArray(state.tasks), 'invalid task state');
  assert(plain(profiles) && profiles.schemaVersion === 1 && plain(profiles.profiles), 'invalid profile registry');
  const profileNames = Object.keys(profiles.profiles);
  assert(profileNames.length > 0, 'no profiles defined');
  for (const [name, profile] of Object.entries(profiles.profiles)) {
    assert(nonEmpty(name) && plain(profile) && nonEmpty(profile.description), `invalid profile ${name}`);
    uniqueStrings(profile.requiredEvidence, `profile ${name} evidence`);
    assert(profile.requiredEvidence.every(kind => PROOF_TYPES.has(kind)), `profile ${name} has unsupported evidence type`);
    assert(profile.requiredEvidence.includes('artifact') && profile.requiredEvidence.includes('review'), `profile ${name} must require artifact and review`);
  }
  const ids = new Set();
  for (const task of state.tasks) {
    assert(plain(task) && SAFE_ID.test(task.id) && !ids.has(task.id), 'task ID invalid or duplicated');
    ids.add(task.id);
    assert(nonEmpty(task.title) && nonEmpty(task.objective), `${task.id}: missing title/objective`);
    assert(profiles.profiles[task.profile], `${task.id}: unknown profile`);
    uniqueStrings(task.acceptance, `${task.id}: acceptance`);
    uniqueStrings(task.dependsOn, `${task.id}: dependencies`, true);
    assert(STATUSES.has(task.status), `${task.id}: invalid status`);
    assert(task.owner === null || nonEmpty(task.owner), `${task.id}: invalid owner`);
    assert(task.blockedReason === null || nonEmpty(task.blockedReason), `${task.id}: invalid blocker`);
    assert(task.status !== 'blocked' || nonEmpty(task.blockedReason), `${task.id}: blocked without reason`);
    assert(task.status !== 'in_progress' || nonEmpty(task.owner), `${task.id}: active task without owner`);
    assert(Array.isArray(task.evidence), `${task.id}: missing evidence array`);
    for (const proof of task.evidence) {
      assert(plain(proof) && PROOF_TYPES.has(proof.kind), `${task.id}: invalid evidence kind`);
      assert(['pass', 'fail'].includes(proof.result) && nonEmpty(proof.actor), `${task.id}: invalid evidence declaration`);
      assert(nonEmpty(proof.path) && /^[a-f0-9]{64}$/.test(proof.sha256), `${task.id}: invalid evidence file identity`);
      assert(nonEmpty(proof.note), `${task.id}: missing evidence explanation`);
      assert(nonEmpty(proof.recordedAt), `${task.id}: missing evidence time`);
      if (proof.kind === BUILTIN_PROOF_KINDS[task.profile]) {
        assert(proof.origin === 'builtin-adapter' && plain(proof.input) && nonEmpty(proof.input.path) && /^[a-f0-9]{64}$/.test(proof.input.sha256), `${task.id}: protected proof requires adapter provenance`);
      }
    }
  }
  const byId = new Map(state.tasks.map(task => [task.id, task]));
  for (const task of state.tasks) {
    if (task.status === 'verified') {
      assert(nonEmpty(task.verifiedAt), `${task.id}: verified without timestamp`);
      const latest = new Map(task.evidence.map(proof => [proof.kind, proof]));
      const required = profiles.profiles[task.profile].requiredEvidence;
      for (const kind of required) assert(latest.get(kind)?.result === 'pass', `${task.id}: verified without passing ${kind} evidence`);
      assert(latest.get('review')?.actor !== task.owner, `${task.id}: verified with self-review`);
    }
  }
  let active = 0;
  for (const task of state.tasks) {
    if (task.status === 'in_progress') active++;
    for (const dependency of task.dependsOn) {
      assert(dependency !== task.id && byId.has(dependency), `${task.id}: invalid dependency ${dependency}`);
    }
  }
  assert(active <= 1, 'more than one active task');
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    assert(!visiting.has(id), `dependency cycle at ${id}`);
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of state.tasks) visit(task.id);
  return true;
}

export function selectNext(state) {
  const active = state.tasks.find(task => task.status === 'in_progress');
  if (active) return active;
  const byId = new Map(state.tasks.map(task => [task.id, task]));
  return state.tasks.find(task => task.status === 'pending' && task.dependsOn.every(id => byId.get(id)?.status === 'verified')) ?? null;
}

export function findTask(state, id) {
  const task = state.tasks.find(entry => entry.id === id);
  assert(task, `unknown task ${id}`);
  return task;
}

export function addTask(state, profiles, { title, objective, profile, acceptance, dependsOn = [] }) {
  assert(nonEmpty(title) && nonEmpty(objective), 'title and objective required');
  assert(profiles.profiles[profile], `unsupported profile ${profile}`);
  uniqueStrings(acceptance, 'acceptance');
  uniqueStrings(dependsOn, 'dependencies', true);
  const number = Math.max(0, ...state.tasks.map(task => Number(task.id.slice(3)))) + 1;
  const id = `PP-${String(number).padStart(4, '0')}`;
  const task = { id, title, objective, profile, acceptance, dependsOn, status: 'pending', owner: null, blockedReason: null, evidence: [] };
  state.tasks.push(task);
  validateProject(state, profiles);
  return task;
}

export function startTask(state, id, actor) {
  assert(nonEmpty(actor), 'actor required');
  const task = findTask(state, id);
  if (task.status === 'in_progress' && task.owner === actor) return task;
  assert(task.status === 'pending', `cannot start ${task.status} task`);
  assert(!state.tasks.some(other => other.status === 'in_progress'), 'finish or block the active task first');
  const byId = new Map(state.tasks.map(item => [item.id, item]));
  assert(task.dependsOn.every(dep => byId.get(dep).status === 'verified'), 'dependencies not verified');
  task.status = 'in_progress';
  task.owner = actor;
  return task;
}

export function blockTask(state, id, reason) {
  assert(nonEmpty(reason), 'a blocker reason is required');
  const task = findTask(state, id);
  assert(task.status === 'pending' || task.status === 'in_progress', 'only unverified tasks can be blocked');
  task.status = 'blocked';
  task.blockedReason = reason;
  return task;
}

export function unblockTask(state, id) {
  const task = findTask(state, id);
  assert(task.status === 'blocked', 'task is not blocked');
  task.status = 'pending';
  task.blockedReason = null;
  return task;
}

export async function safeEvidenceFile(root, filePath) {
  assert(nonEmpty(filePath), 'evidence --file required');
  const base = await realpath(root);
  const candidate = resolve(base, filePath);
  const canonical = await realpath(candidate);
  const rel = relative(base, canonical);
  assert(nonEmpty(rel) && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'evidence must be a file inside project root');
  const meta = await stat(canonical);
  assert(meta.isFile(), 'evidence is not a regular file');
  const sha256 = createHash('sha256').update(await readFile(canonical)).digest('hex');
  return { path: rel.replaceAll(sep, '/'), sha256 };
}

export async function recordEvidence(root, state, { id, kind, file, actor, note, result = 'pass', origin = 'manual', input = null }) {
  const task = findTask(state, id);
  assert(task.status === 'in_progress', 'evidence can only be recorded for an active task');
  assert(PROOF_TYPES.has(kind), `unknown evidence kind ${kind}`);
  assert(['pass', 'fail'].includes(result), 'result must be pass or fail');
  assert(nonEmpty(actor) && nonEmpty(note), 'actor and explanatory note required');
  if (kind === 'review') assert(actor !== task.owner, 'reviewer must differ from implementer');
  const protectedKind = BUILTIN_PROOF_KINDS[task.profile];
  if (kind === protectedKind) {
    assert(origin === 'builtin-adapter' && plain(input) && nonEmpty(input.path) && /^[a-f0-9]{64}$/.test(input.sha256), `${kind} evidence requires a built-in adapter check; manual proof cannot override it`);
    assert(actor === task.owner, 'adapter evidence must be produced by the task owner');
  } else {
    assert(origin === 'manual' && input === null, 'adapter provenance is restricted to its built-in proof kind');
  }
  const identity = await safeEvidenceFile(root, file);
  const proof = { kind, result, actor, note, ...identity, recordedAt: new Date().toISOString(), ...(origin === 'builtin-adapter' ? { origin, input } : {}) };
  task.evidence.push(proof);
  return proof;
}

export async function verifyClosure(root, task, profile) {
  assert(task.status === 'in_progress', 'task is not in progress');
  const required = profile.requiredEvidence;
  const latest = new Map();
  for (const proof of task.evidence) latest.set(proof.kind, proof);
  const missing = required.filter(kind => !latest.has(kind));
  assert(missing.length === 0, `missing required evidence: ${missing.join(', ')}`);
  for (const kind of required) {
    const proof = latest.get(kind);
    assert(proof.result === 'pass', `latest ${kind} proof failed`);
    const current = await safeEvidenceFile(root, proof.path);
    assert(current.sha256 === proof.sha256, `stale evidence file: ${proof.path}`);
  }
  const reserved = BUILTIN_PROOF_KINDS[task.profile];
  if (reserved && required.includes(reserved)) {
    const proof = latest.get(reserved);
    assert(proof.origin === 'builtin-adapter' && plain(proof.input), 'adapter proof provenance missing');
    const report = JSON.parse(await readFile(resolve(root, proof.path), 'utf8'));
    assert(report.schemaVersion === 1 && report.taskId === task.id && report.adapter === task.profile && report.evidenceKind === reserved && report.result === proof.result, 'adapter report identity mismatch');
    assert(report.input?.path === proof.input.path && report.input?.sha256 === proof.input.sha256, 'adapter source identity mismatch');
    const source = await safeEvidenceFile(root, proof.input.path);
    assert(source.path === proof.input.path && source.sha256 === proof.input.sha256, `stale adapter input: ${proof.input.path}`);
    const policy = JSON.parse(await readFile(resolve(root, '.pro-papa/adapter-policy.json'), 'utf8'));
    assert(policy.adapters?.[task.profile]?.enabled === true && policy.adapters[task.profile].capability === report.capability, 'adapter disabled or capability policy changed');
  }
  const review = latest.get('review');
  assert(review.actor !== task.owner, 'reviewer must differ from task owner');
  return { required, verifiedFiles: required.map(kind => latest.get(kind).path) };
}

export async function closeTask(root, state, profiles, id) {
  const task = findTask(state, id);
  const report = await verifyClosure(root, task, profiles.profiles[task.profile]);
  task.status = 'verified';
  task.verifiedAt = new Date().toISOString();
  return report;
}

export async function saveState(root, state, profiles) {
  validateProject(state, profiles);
  const location = resolve(root, '.pro-papa/tasks.json');
  const lockPath = `${location}.lock`;
  let lock;
  try {
    lock = await open(lockPath, 'wx');
    const onDisk = JSON.parse(await readFile(location, 'utf8'));
    assert(onDisk.revision === state.revision, 'state changed since load; reload and retry (stale writer)');
    const temp = `${location}.${process.pid}.tmp`;
    const nextRevision = state.revision + 1;
    try {
      await writeFile(temp, `${JSON.stringify({ ...state, revision: nextRevision }, null, 2)}\n`, { flag: 'wx' });
      await rename(temp, location);
      state.revision = nextRevision;
    } finally {
      await rm(temp, { force: true });
    }
  } finally {
    if (lock) { await lock.close(); await rm(lockPath, { force: true }); }
  }
}

export function taskHandoff(task, profiles) {
  const required = profiles.profiles[task.profile].requiredEvidence;
  return [
    `Task: ${task.id} — ${task.title}`,
    `Profile: ${task.profile}`,
    `Objective: ${task.objective}`,
    'Acceptance:',
    ...task.acceptance.map(text => `- ${text}`),
    `Required evidence: ${required.join(', ')}`,
    'Workflow: inspect → plan → implement → test → inspect actual output → independent review → record proof → close.',
    'Do not substitute claims or CI green status for actual artifact/content review.',
    'Report external dependencies; do not invent work, tool access, proof or success.',
  ].join('\n');
}

export async function initializeProject(root, name, options = {}) {
  assert(nonEmpty(name), 'project name required');
  const target = resolve(root);
  const folder = resolve(target, '.pro-papa');
  // Preflight every destination before creating anything, preventing partial initialization
  // if a project already has AGENTS.md or Pro-Papa state.
  for (const file of [resolve(folder, 'tasks.json'), resolve(folder, 'profiles.json'), resolve(folder, 'adapter-policy.json'), ...(options.agentGuide ? [resolve(target, 'AGENTS.md')] : [])]) {
    try { await access(file); fail(`already exists: ${file}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(folder, { recursive: true });
  const state = { schemaVersion: 1, revision: 0, project: name, tasks: [] };
  const profileFile = new URL('../.pro-papa/profiles.json', import.meta.url);
  const profiles = JSON.parse(await readFile(profileFile, 'utf8'));
  const adapterPolicyFile = new URL('../.pro-papa/adapter-policy.json', import.meta.url);
  const adapterPolicy = JSON.parse(await readFile(adapterPolicyFile, 'utf8'));
  // Never overwrite an existing agent's state.
  const initial = [
    [resolve(folder, 'tasks.json'), `${JSON.stringify(state, null, 2)}\n`],
    [resolve(folder, 'profiles.json'), `${JSON.stringify(profiles, null, 2)}\n`],
    [resolve(folder, 'adapter-policy.json'), `${JSON.stringify(adapterPolicy, null, 2)}\n`],
  ];
  for (const [file, content] of initial) {
    const fd = await open(file, 'wx');
    try { await fd.writeFile(content); } finally { await fd.close(); }
  }
  if (options.agentGuide) {
    const file = resolve(target, 'AGENTS.md');
    const fd = await open(file, 'wx');
    try { await fd.writeFile('# AI work contract\n\nRead .pro-papa/tasks.json and .pro-papa/profiles.json. Use Pro-Papa CLI to select one task, execute it with tools available in your environment, record file-backed evidence, obtain separate review, and close only after required evidence passes. Do not claim AI runs automatically or in the background.\n'); }
    finally { await fd.close(); }
  }
  return state;
}
