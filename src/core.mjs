import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, realpath, stat, open, rm, access } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { validateReviewTarget, verifyGitHubReview } from './review-github.mjs';

const STATUSES = new Set(['pending', 'in_progress', 'blocked', 'verified']);
const PROOF_TYPES = new Set(['artifact', 'test', 'validation', 'review', 'sources', 'calculations', 'adapter']);
// The adapter check is a distinct proof: syntax is not a software test, citation
// structure is not a source audit, and Markdown structure is not content review.
export const BUILTIN_PROOF_KINDS = Object.freeze({ software: 'adapter', research: 'adapter', document: 'adapter' });
// Historical v0.1 adapter outputs used these domain-proof kinds. Keep them
// readable so upgrading cannot strand a verified or active project.
const LEGACY_BUILTIN_KINDS = Object.freeze({ software: 'test', research: 'sources', document: 'validation' });
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
    assert(task.requiresAdapter === undefined || typeof task.requiresAdapter === 'boolean', `${task.id}: invalid requiresAdapter flag`);
    assert(task.requiresTrustedReview === undefined || typeof task.requiresTrustedReview === 'boolean', `${task.id}: invalid requiresTrustedReview flag`);
    if (task.reviewTarget !== undefined) validateReviewTarget(task.reviewTarget);
    if (task.requiresTrustedReview) assert(task.reviewTarget !== undefined, `${task.id}: review target required`);
    assert(!task.requiresAdapter || Object.hasOwn(BUILTIN_PROOF_KINDS, task.profile), `${task.id}: no adapter exists for profile`);
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
      // Preserve pre-upgrade adapter proofs in the legacy domain kind, but do not
      // let them stand in for a real domain test/source/validation on new tasks.
      if (proof.kind === 'adapter' || proof.origin === 'builtin-adapter') {
        assert(proof.origin === 'builtin-adapter' && (proof.kind === 'adapter' || proof.kind === LEGACY_BUILTIN_KINDS[task.profile]) && plain(proof.input) && nonEmpty(proof.input.path) && /^[a-f0-9]{64}$/.test(proof.input.sha256), `${task.id}: adapter proof requires source provenance`);
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
      // Historical verified tasks are not retroactively subject to new gates.
      if (task.requiresAdapter) {
        assert(latest.get('adapter')?.result === 'pass', `${task.id}: verified without passing adapter evidence`);
        const oldKind = LEGACY_BUILTIN_KINDS[task.profile];
        assert(latest.get(oldKind)?.origin !== 'builtin-adapter', `${task.id}: adapter syntax proof cannot substitute for real ${oldKind} evidence`);
      }
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
  const task = { id, title, objective, profile, acceptance, dependsOn, status: 'pending', owner: null, blockedReason: null, evidence: [], ...(Object.hasOwn(BUILTIN_PROOF_KINDS, profile) ? { requiresAdapter: true } : {}) };
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
  if (kind === 'adapter') {
    assert(Object.hasOwn(BUILTIN_PROOF_KINDS, task.profile), 'no built-in adapter for this profile');
    assert(origin === 'builtin-adapter' && plain(input) && nonEmpty(input.path) && /^[a-f0-9]{64}$/.test(input.sha256), 'adapter evidence requires built-in validator source provenance');
    assert(actor === task.owner, 'adapter evidence must be produced by the task owner');
  } else {
    // Domain proofs remain usable for genuine test runs, source audits, and
    // content validation, including files from existing v0.1 projects.
    assert(origin === 'manual' && input === null, 'only adapter-check can issue new built-in adapter evidence');
  }
  const identity = await safeEvidenceFile(root, file);
  const proof = { kind, result, actor, note, ...identity, recordedAt: new Date().toISOString(), ...(origin === 'builtin-adapter' ? { origin, input } : {}) };
  task.evidence.push(proof);
  return proof;
}

export async function verifyClosure(root, task, profile, options = {}) {
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
  const adapterIsRequired = task.requiresAdapter === true || task.evidence.some(proof => proof.kind === 'adapter');
  if (adapterIsRequired) {
    const proof = latest.get('adapter');
    assert(proof, 'missing required evidence: adapter');
    assert(proof.result === 'pass', 'latest adapter proof failed');
    assert(proof.origin === 'builtin-adapter' && plain(proof.input), 'adapter proof provenance missing');
    const reportIdentity = await safeEvidenceFile(root, proof.path);
    assert(reportIdentity.sha256 === proof.sha256 && reportIdentity.path === proof.path, 'stale adapter report');
    const report = JSON.parse(await readFile(resolve(root, proof.path), 'utf8'));
    assert(report.schemaVersion === 1 && report.taskId === task.id && report.adapter === task.profile && report.evidenceKind === 'adapter' && report.result === proof.result, 'adapter report identity mismatch');
    assert(report.input?.path === proof.input.path && report.input?.sha256 === proof.input.sha256, 'adapter source identity mismatch');
    const source = await safeEvidenceFile(root, proof.input.path);
    assert(source.path === proof.input.path && source.sha256 === proof.input.sha256, `stale adapter input: ${proof.input.path}`);
    const policy = JSON.parse(await readFile(resolve(root, '.pro-papa/adapter-policy.json'), 'utf8'));
    assert(policy.adapters?.[task.profile]?.enabled === true && policy.adapters[task.profile].capability === report.capability, 'adapter disabled or capability policy changed');
    const legacyKind = LEGACY_BUILTIN_KINDS[task.profile];
    assert(latest.get(legacyKind)?.origin !== 'builtin-adapter', `real ${legacyKind} evidence required; legacy adapter proof is insufficient`);
  }
  const review = latest.get('review');
  assert(review.actor !== task.owner, 'reviewer must differ from task owner');
  let trustedReview = null;
  if (task.requiresTrustedReview) {
    // A task-file PASS claim is not authority. Ask GitHub on every closure.
    trustedReview = await verifyGitHubReview(task.reviewTarget, options);
    assert(trustedReview.verdict === 'PASS', `trusted review rejected: ${trustedReview.reason}`);
    // Accept any actual, current-SHA, provider-approved reviewer whose account
    // matches the file-backed review actor; not merely the last selected account.
    assert(trustedReview.approvedReviewers.some(candidate =>
      candidate.login.toLowerCase() === review.actor.toLowerCase()),
      'recorded reviewer identity differs from GitHub authenticated reviewer');
  }
  return { required, verifiedFiles: required.map(kind => latest.get(kind).path), ...(trustedReview ? { trustedReview } : {}) };
}

export async function closeTask(root, state, profiles, id, options = {}) {
  const task = findTask(state, id);
  const report = await verifyClosure(root, task, profiles.profiles[task.profile], options);
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
    `Required evidence: ${[...required, ...(task.requiresAdapter ? ['adapter'] : []), ...(task.requiresTrustedReview ? ['authenticated GitHub approval'] : [])].join(', ')}`,
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
