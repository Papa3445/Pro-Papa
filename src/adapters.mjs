import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { findTask, safeEvidenceFile, recordEvidence } from './core.mjs';

const execFileAsync = promisify(execFile);
const MAX_INPUT_BYTES = 1024 * 1024;

// These are *code-defined* capabilities, not executable commands from a task or JSON file.
// A project policy can revoke one; it cannot register code or elevate a capability.
export const BUILTIN_ADAPTERS = Object.freeze({
  software: Object.freeze({ capability: 'syntax:node', evidenceKind: 'test' }),
  research: Object.freeze({ capability: 'citations:structure', evidenceKind: 'sources' }),
  document: Object.freeze({ capability: 'markdown:structure', evidenceKind: 'validation' }),
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
  // The invocation is fixed and shell-free. --check parses syntax; it does not execute JS.
  // Task content never controls the executable or command flags.
  try {
    await execFileAsync(process.execPath, ['--check', file], {
      shell: false,
      timeout: 8000,
      maxBuffer: 16384,
      env: { NODE_OPTIONS: '', NODE_PATH: '' },
      windowsHide: true,
    });
    return { pass: true, checks: ['Node.js syntax check passed (no code executed)'] };
  } catch (error) {
    return { pass: false, checks: [`Node.js syntax check failed: ${String(error.stderr || error.message).slice(0, 1200)}`] };
  }
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
  const titles = lines.filter(line => /^# \S/.test(line));
  const sections = lines.filter(line => /^## \S/.test(line));
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  if (titles.length !== 1) issues.push('Exactly one Markdown H1 title is required');
  if (sections.length < 2) issues.push('At least two Markdown H2 sections are required');
  if (words < 40) issues.push('Document must contain at least 40 words');
  if (/\b(?:TODO|TBD|FIXME)\b|\[insert[^\]]*\]/i.test(content)) issues.push('Unresolved placeholder detected');
  return { pass: issues.length === 0, checks: issues.length ? issues : [`Markdown structure valid: 1 title, ${sections.length} sections, ${words} words; content quality not checked`] };
}

export async function runDomainCheck({ root, state, id, actor, file }) {
  const task = findTask(state, id);
  requireValid(task.status === 'in_progress', 'Adapter requires an in-progress task');
  requireValid(isText(actor) && actor === task.owner, 'Adapter actor must match task owner');
  const definition = BUILTIN_ADAPTERS[task.profile];
  requireValid(definition, `No built-in adapter for profile ${task.profile}`);
  const policy = validateAdapterPolicy(JSON.parse(await readFile(resolve(root, '.pro-papa/adapter-policy.json'), 'utf8')));
  requireValid(policy.adapters[task.profile].enabled, `Adapter ${task.profile} denied by project policy`);
  const identity = await safeEvidenceFile(root, file);
  const input = resolve(root, identity.path);
  const metadata = await stat(input);
  requireValid(metadata.size > 0 && metadata.size <= MAX_INPUT_BYTES, 'Adapter input must be 1 byte to 1 MiB');
  const contents = await readFile(input, 'utf8');
  const ext = extname(input).toLowerCase();
  let outcome;
  if (task.profile === 'software') outcome = await checkSoftware(input, contents);
  else if (task.profile === 'research') outcome = ext === '.json' ? checkResearch(contents) : { pass: false, checks: ['Research adapter requires a .json file'] };
  else outcome = ext === '.md' ? checkDocument(contents) : { pass: false, checks: ['Document adapter requires a .md file'] };

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
  });
  return { report, reportFile: reportRel, proof };
}
