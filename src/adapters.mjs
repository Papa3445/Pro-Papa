import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm, open, readFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { findTask, safeEvidenceFile, recordEvidence, BUILTIN_PROOF_KINDS } from './core.mjs';

const execFileAsync = promisify(execFile);
const MAX_INPUT_BYTES = 1024 * 1024;

// These are *code-defined* capabilities, not executable commands from a task or JSON file.
// A project policy can revoke one; it cannot register code or elevate a capability.
export const BUILTIN_ADAPTERS = Object.freeze({
  software: Object.freeze({ capability: 'syntax:node', evidenceKind: BUILTIN_PROOF_KINDS.software }),
  research: Object.freeze({ capability: 'citations:structure', evidenceKind: BUILTIN_PROOF_KINDS.research }),
  document: Object.freeze({ capability: 'markdown:structure', evidenceKind: BUILTIN_PROOF_KINDS.document }),
});

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateAdapterPolicy(policy) {
  requireValid(policy && !Array.isArray(policy) && typeof policy === 'object' && policy.schemaVersion === 1, 'Invalid adapter policy schema');
  requireValid(policy.adapters && !Array.isArray(policy.adapters) && typeof policy.adapters === 'object', 'Missing adapter policy');
  const names = Object.keys(policy.adapters);
  requireValid(names.length === Object.keys(BUILTIN_ADAPTERS).length && names.every(name => Object.hasOwn(BUILTIN_ADAPTERS, name)), 'Adapter policy must list only the built-in adapters');
  for (const [name, rule] of Object.entries(policy.adapters)) {
    requireValid(rule && !Array.isArray(rule) && typeof rule === 'object', `Invalid adapter rule: ${name}`);
    requireValid(typeof rule.enabled === 'boolean', `Adapter ${name} must declare enabled`);
    requireValid(rule.capability === BUILTIN_ADAPTERS[name].capability, `Adapter ${name} cannot change its capability`);
    requireValid(Object.keys(rule).every(key => ['enabled', 'capability'].includes(key)), `Adapter ${name} contains unsupported policy fields`);
  }
  requireValid(Object.keys(policy).every(key => ['schemaVersion', 'adapters'].includes(key)), 'Unexpected adapter policy fields');
  return policy;
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function checkSoftware(file, content) {
  const ext = extname(file).toLowerCase();
  if (ext === '.json') {
    try {
      JSON.parse(content);
      return { pass: true, checks: ['JSON parses successfully'] };
    } catch (error) {
      return { pass: false, checks: [`JSON syntax invalid: ${error.message}`] };
    }
  }
  if (!['.js', '.mjs', '.cjs'].includes(ext)) {
    return { pass: false, checks: ['Only .js, .mjs, .cjs, or .json syntax checks are supported'] };
  }
  // Validate exactly the immutable bytes read by the adapter, not the mutable source path.
  // The private snapshot is placed under the input directory so .js still inherits its
  // nearest package.json `type` (ESM or CJS); it is removed after validation.
  const folder = await mkdtemp(resolve(dirname(file), '.pro-papa-syntax-'));
  try {
    const snapshot = resolve(folder, `source${ext}`);
    const descriptor = await open(snapshot, 'wx', 0o600);
    try { await descriptor.writeFile(content); } finally { await descriptor.close(); }
    try {
      await execFileAsync(process.execPath, ['--check', snapshot], {
        shell: false, timeout: 8000, maxBuffer: 16384,
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' }, windowsHide: true,
      });
      return { pass: true, checks: ['Node.js syntax check passed on immutable snapshot (no code executed)'] };
    } catch (error) {
      return { pass: false, checks: [`Node.js syntax check failed: ${String(error.stderr || error.message).slice(0, 1200)}`] };
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
}

function checkResearch(content) {
  let report;
  try { report = JSON.parse(content); }
  catch { return { pass: false, checks: ['Research input must be valid JSON'] }; }
  const issues = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) issues.push('Expected a JSON report object');
  const sources = report?.sources;
  const claims = report?.claims;
  if (!Array.isArray(sources) || sources.length === 0) issues.push('At least one source is required');
  if (!Array.isArray(claims) || claims.length === 0) issues.push('At least one claim is required');
  const ids = new Set();
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || !isText(source.id) || !isText(source.title) || !isText(source.url) || ids.has(source.id)) {
      issues.push('Sources need unique nonempty id, title, and URL');
      continue;
    }
    ids.add(source.id);
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) issues.push(`Unsupported source URL: ${source.id}`);
    } catch { issues.push(`Malformed source URL: ${source.id}`); }
  }
  for (const [index, claim] of (Array.isArray(claims) ? claims : []).entries()) {
    if (!claim || !isText(claim.text) || !Array.isArray(claim.sourceIds) || !claim.sourceIds.length || claim.sourceIds.some(id => !ids.has(id))) {
      issues.push(`Claim ${index + 1} must cite at least one declared source`);
    }
  }
  return { pass: issues.length === 0, checks: issues.length ? issues : [`Structured citations valid: ${claims.length} claims, ${sources.length} sources; factual accuracy not checked`] };
}

function checkDocument(content) {
  const issues = [];
  const lines = content.split(/\r?\n/);
  // Ignore all fenced-code content for heading and word-count checks, including
  // fences started with backticks or tildes and unclosed fences.
  let fence = null;
  const prose = [];
  for (const line of lines) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (match) {
      const symbol = match[1][0];
      if (!fence) fence = { symbol, length: match[1].length };
      else if (symbol === fence.symbol && match[1].length >= fence.length && /^\s*$/.test(line.slice(match[0].length))) fence = null;
      continue;
    }
    if (!fence && !/^(?: {4}|\t)/.test(line)) prose.push(line);
  }
  const titles = prose.filter(line => /^# \S/.test(line));
  const sections = prose.filter(line => /^## \S/.test(line));
  const words = prose.join(' ').trim().split(/\s+/).filter(Boolean).length;
  if (titles.length !== 1) issues.push('Exactly one Markdown H1 title is required outside code fences');
  if (sections.length < 2) issues.push('At least two Markdown H2 sections are required outside code fences');
  if (words < 40) issues.push('Document prose must contain at least 40 words outside code fences');
  if (/\b(?:TODO|TBD|FIXME)\b|\[insert[^\]]*\]/i.test(prose.join('\n'))) issues.push('Unresolved placeholder detected');
  return { pass: issues.length === 0, checks: issues.length ? issues : [`Markdown structure valid: 1 title, ${sections.length} sections, ${words} prose words; content quality not checked`] };
}

// Read from one opened file descriptor, never validate a path read in two different
// states. Any replacement/retargeting detected before recording is rejected.
export async function readAdapterSnapshot(root, file) {
  const before = await safeEvidenceFile(root, file);
  const filename = resolve(root, before.path);
  const descriptor = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  let data;
  try {
    const first = await descriptor.stat();
    requireValid(first.isFile() && first.size > 0 && first.size <= MAX_INPUT_BYTES, 'Adapter input must be 1 byte to 1 MiB');
    data = await descriptor.readFile();
    const last = await descriptor.stat();
    requireValid(first.dev === last.dev && first.ino === last.ino && first.size === last.size && first.mtimeMs === last.mtimeMs, 'Adapter input changed during snapshot');
  } finally { await descriptor.close(); }
  const after = await safeEvidenceFile(root, file);
  const sha256 = createHash('sha256').update(data).digest('hex');
  requireValid(before.path === after.path && before.sha256 === sha256 && after.sha256 === sha256, 'Adapter input changed during snapshot');
  return { identity: { path: before.path, sha256 }, file: filename, contents: data.toString('utf8') };
}

export async function runDomainCheck({ root, state, id, actor, file }, { afterSnapshot } = {}) {
  const task = findTask(state, id);
  requireValid(task.status === 'in_progress', 'Adapter requires an in-progress task');
  requireValid(isText(actor) && actor === task.owner, 'Adapter actor must match task owner');
  const definition = BUILTIN_ADAPTERS[task.profile];
  requireValid(definition, `No built-in adapter for profile ${task.profile}`);
  const policy = validateAdapterPolicy(JSON.parse(await readFile(resolve(root, '.pro-papa/adapter-policy.json'), 'utf8')));
  requireValid(policy.adapters[task.profile].enabled, `Adapter ${task.profile} denied by project policy`);
  const snapshot = await readAdapterSnapshot(root, file);
  const { identity, contents } = snapshot;
  const input = snapshot.file;
  // Trusted test seam; task JSON and CLI cannot supply code or a callback.
  if (afterSnapshot) await afterSnapshot();
  const ext = extname(input).toLowerCase();
  let outcome;
  if (task.profile === 'software') outcome = await checkSoftware(input, contents);
  else if (task.profile === 'research') outcome = ext === '.json' ? checkResearch(contents) : { pass: false, checks: ['Research adapter requires a .json file'] };
  else outcome = ext === '.md' ? checkDocument(contents) : { pass: false, checks: ['Document adapter requires a .md file'] };

  const current = await safeEvidenceFile(root, file);
  requireValid(current.path === identity.path && current.sha256 === identity.sha256, 'Adapter input changed during validation');

  const report = {
    schemaVersion: 1,
    taskId: task.id,
    adapter: task.profile,
    capability: definition.capability,
    evidenceKind: definition.evidenceKind,
    input: identity,
    result: outcome.pass ? 'pass' : 'fail',
    checks: outcome.checks,
    // These statements are intentional, to prevent accidental claims of independent review.
    limits: ['No claims of factual correctness or product quality', 'No independent review performed'],
    timestamp: new Date().toISOString(),
  };
  const reportRel = `.pro-papa/evidence/${task.id}/${task.profile}-${randomUUID()}.json`;
  const reportFile = resolve(root, reportRel);
  await mkdir(dirname(reportFile), { recursive: true });
  const fd = await open(reportFile, 'wx');
  try { await fd.writeFile(`${JSON.stringify(report, null, 2)}\n`); }
  finally { await fd.close(); }
  const proof = await recordEvidence(root, state, {
    id: task.id,
    kind: definition.evidenceKind,
    file: reportFile,
    actor,
    result: report.result,
    note: `Built-in ${task.profile} check (${definition.capability}); input sha256 ${identity.sha256}`,
    origin: 'builtin-adapter', input: identity,
  });
  return { report, reportFile: reportRel, proof };
}
