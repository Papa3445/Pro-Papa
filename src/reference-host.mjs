// PP-0006 — executable host; user requests never define tool grants or audit policy.
import { runGateway, routeObjective } from './gateway.mjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { issueUsageReceipt } from './usage-receipts.mjs';
import { blockedExecutionTrace, releaseExecutionTrace,
  verifyReleasedExecution } from './execution-trace.mjs';
import { buildWeeklyPlan } from './planning.mjs';
import { draftMemo } from './memo.mjs';
import { generateIsoDateModule } from './iso-date.mjs';
import { validatePdfArtifact } from './artifact-validation.mjs';
const REPO = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fail = () => { throw Error('Unverified host configuration or provider output'); };
const same = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  a.toLowerCase() === b.toLowerCase();
const queues = new Map();

const SHA256 = /^[0-9a-f]{64}$/;
const ISSUE_ACTION = 'github.create_issue';
/**
 * Review the exact issue contents before issuing this digest out-of-band.
 * The digest is an approval identity, NOT authorization on its own.
 */
export function issueApprovalDigest({ requestId, repository, title, body = '' }) {
  if (typeof requestId !== 'string' || !UUID.test(requestId) ||
      typeof repository !== 'string' || !REPO.test(repository) ||
      typeof title !== 'string' || !title.trim() || title.length > 120 ||
      typeof body !== 'string' || body.length > 2048) fail();
  const payload = JSON.stringify({ requestId: requestId.toLowerCase(),
    repository: repository.toLowerCase(), action: ISSUE_ACTION, title, body });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
function approvedPayload(request, expected) {
  try {
    if (!expected || !same(request.id, expected.requestId) ||
        routeObjective(request) !== 'operations' ||
        request.inputs?.action !== ISSUE_ACTION ||
        !same(request.inputs?.repository, expected.repository)) return false;
    const digest = issueApprovalDigest({ requestId: request.id,
      repository: request.inputs.repository,
      title: request.inputs.title, body: request.inputs.body ?? '' });
    return timingSafeEqual(Buffer.from(digest, 'hex'),
      Buffer.from(expected.payloadSha256, 'hex'));
  } catch { return false; }
}


function snapshotRequest(input) {
  const visited = new Set();
  let nodes = 0;
  function copy(value, depth) {
    if (++nodes > 10000 || depth > 64) fail();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
    if (typeof value !== 'object' || visited.has(value)) fail();
    visited.add(value);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype :
      prototype !== Object.prototype && prototype !== null) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string')) fail();
    if (array) {
      if (value.length > 10000 || keys.length !== value.length + 1) fail();
      const result = [];
      for (let i = 0; i < value.length; i++) {
        const d = descriptors[String(i)];
        if (!d || !d.enumerable || !Object.hasOwn(d, 'value')) fail();
        result.push(copy(d.value, depth + 1));
      }
      return result;
    }
    const result = Object.create(null);
    for (const key of keys) {
      const d = descriptors[key];
      if (!d.enumerable || !Object.hasOwn(d, 'value')) fail();
      Object.defineProperty(result, key, { value: copy(d.value, depth + 1),
        enumerable: true, writable: true, configurable: true });
    }
    return result;
  }
  try {
    const copied = copy(input, 0), wire = JSON.stringify(copied);
    if (typeof wire !== 'string' || Buffer.byteLength(wire) > 65536) return null;
    return JSON.parse(wire);
  } catch { return null; }
}


// Per-process serialization; cross-process conflicts remain conservatively gated
// by the gateway's filesystem locks and incomplete-effect reconciliation.
async function exclusive(key, work) {
  if (!key) return work();
  const prior = queues.get(key) ?? Promise.resolve();
  let done;
  const current = new Promise(resolve => { done = resolve; });
  const tail = prior.catch(() => {}).then(() => current);
  queues.set(key, tail);
  await prior.catch(() => {});
  try { return await work(); } finally {
    done();
    if (queues.get(key) === tail) queues.delete(key);
  }
}
function allowedRepo(inputs, repos) {
  const name = inputs?.repository;
  const approved = repos.find(repo => same(repo, name));
  if (!approved) fail();
  return approved;
}
async function github({ fetchImpl, token, repo, issue }) {
  const response = await fetchImpl('https://api.github.com/repos/' + repo +
    (issue ? '/issues' : ''), {
    method: issue ? 'POST' : 'GET',
    redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Pro-Papa-reference-host',
      ...(typeof token === 'string' && token ? { Authorization: 'Bearer ' + token } : {}),
      ...(issue ? { 'Content-Type': 'application/json' } : {}) },
    ...(issue ? { body: JSON.stringify(issue) } : {}),
  });
  if (!response?.ok || (issue && response.status !== 201)) fail();
  const data = await response.json();
  if (!plain(data)) fail();
  return data;
}
function verifyReceipt(receipt, store) {
  if (!plain(receipt) || receipt.status !== 'confirmed' ||
      receipt.visibility !== 'private' || !same(receipt.storeRepository, store) ||
      typeof receipt.receiptCommit !== 'string' ||
      !/^[a-f0-9]{40}$/.test(receipt.receiptCommit) ||
      typeof receipt.receiptId !== 'string' || !UUID.test(receipt.receiptId) ||
      typeof receipt.sourceCommit !== 'string' ||
      !/^[a-f0-9]{40}$/.test(receipt.sourceCommit) ||
      !Array.isArray(receipt.consulted) || receipt.consulted.length !== 2 ||
      !['AGENTS.md', '.pro-papa/profiles.json'].every(path =>
        receipt.consulted.some(item =>
          item.path === path && /^[a-f0-9]{40}$/.test(item.gitBlobSha)))) return false;
  const prefix = 'https://github.com/' + store + '/blob/' + receipt.receiptCommit +
    '/usage-receipts/';
  const url = receipt.receiptUrl;
  if (typeof url !== 'string' || !url.toLowerCase().startsWith(prefix.toLowerCase()) ||
      !url.endsWith('/' + receipt.receiptId + '.json')) return false;
  const month = url.slice(prefix.length, -('/' + receipt.receiptId + '.json').length);
  return /^\d{4}\/\d{2}$/.test(month);
}

/**
 * Only the trusted caller configures grants, fixed GitHub repos, token, auditing
 * and an approved effect. Request fields cannot change these controls.
 */
export function createReferenceHost({
  allowedRepositories = [], githubResearch = false, approvedIssue = null,
  auditMode = 'off', auditRepository = null,
  sourceRepository = 'Papa3445/Pro-Papa', token = process.env.GITHUB_TOKEN,
  fetchImpl = globalThis.fetch, auditFetchImpl = undefined,
  auditTransport = 'native', traceMode = 'off',
  durableProject = null, durableSecret = process.env.PRO_PAPA_GATEWAY_SECRET,
  artifactValidationEnabled = false,
} = {}) {
  if (!Array.isArray(allowedRepositories) || allowedRepositories.length > 16 ||
      allowedRepositories.some(repo => typeof repo !== 'string' || !REPO.test(repo)) ||
      typeof githubResearch !== 'boolean' || typeof fetchImpl !== 'function' ||
      !['off', 'required'].includes(auditMode) ||
      !['off','enforced'].includes(traceMode) ||
      !['native', 'simulation'].includes(auditTransport) ||
      (auditTransport === 'native' && auditFetchImpl !== undefined) ||
      (auditTransport === 'simulation' &&
        (auditMode !== 'required' || typeof auditFetchImpl !== 'function')) ||
      (auditMode === 'required' &&
        (typeof auditRepository !== 'string' || !REPO.test(auditRepository) ||
          !REPO.test(sourceRepository) || same(auditRepository, sourceRepository))) ||
      !(durableProject === null || typeof durableProject === 'string') ||
      typeof artifactValidationEnabled !== 'boolean') fail();
  if (approvedIssue && (!plain(approvedIssue) || !UUID.test(approvedIssue.requestId ?? '') ||
      typeof approvedIssue.payloadSha256 !== 'string' ||
      !SHA256.test(approvedIssue.payloadSha256) ||
      !allowedRepositories.some(repo => same(repo, approvedIssue.repository)) ||
      !durableProject || typeof durableSecret !== 'string' ||
      durableSecret.length < 16 || typeof token !== 'string' || !token)) fail();

  const grants = ['math.sum', 'text.metrics', 'plan.week', 'memo.draft', 'code.iso-date'];
  if (githubResearch) grants.push('research');
  if (artifactValidationEnabled) grants.push('artifact.validate');
  if (approvedIssue) grants.push('operations');

  const handlers = {
    'artifact.validate': async ({ inputs }) => ({
      ok: true, output: validatePdfArtifact(inputs,{enabled:artifactValidationEnabled}),
      provenance: {provider:'local-node',operation:'artifact.validate'},
    }),
    'math.sum': async ({ inputs }) => {
      if (!plain(inputs) || !Array.isArray(inputs.numbers) ||
          inputs.numbers.length < 1 || inputs.numbers.length > 100 ||
          inputs.numbers.some(n => typeof n !== 'number' || !Number.isFinite(n))) fail();
      const total = inputs.numbers.reduce((a, b) => a + b, 0);
      if (!Number.isFinite(total)) fail();
      return { ok: true, output: { total, count: inputs.numbers.length },
        provenance: { provider: 'local-node', operation: 'math.sum' } };
    },
    'text.metrics': async ({ objective }) => ({
      ok: true, output: {
        characters: Array.from(objective).length,
        words: objective.trim().split(/\s+/u).filter(Boolean).length,
      }, provenance: { provider: 'local-node', operation: 'text.metrics' },
    }),
    // This creates an in-memory draft only; it cannot publish to a calendar.
    'plan.week': async ({ inputs }) => ({
      ok: true, output: buildWeeklyPlan(inputs),
      provenance: { provider: 'local-node', operation: 'plan.week' },
    }),
    // Local text-only document; no filesystem write, email, publishing or external effect.
    'memo.draft': async ({ inputs }) => ({
      ok: true, output: draftMemo(inputs),
      provenance: { provider: 'local-node', operation: 'memo.draft' },
    }),
    // Generates a fixed, tested parser source; never executes requester-provided source.
    'code.iso-date': async ({ inputs }) => ({
      ok: true, output: generateIsoDateModule(inputs),
      provenance: { provider: 'local-node', operation: 'code.iso-date' },
    }),
    research: async ({ inputs }) => {
      const repo = allowedRepo(inputs, allowedRepositories);
      const data = await github({ fetchImpl, token, repo });
      if (!same(data.full_name, repo) || !Number.isSafeInteger(data.id) || data.id < 1 ||
          data.html_url !== 'https://github.com/' + data.full_name ||
          typeof data.private !== 'boolean' ||
          !Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0 ||
          !Number.isSafeInteger(data.open_issues_count) || data.open_issues_count < 0 ||
          !(typeof data.description === 'string' || data.description === null)) fail();
      return { ok: true, output: {
        repository: data.full_name, description: data.description,
        private: data.private, stars: data.stargazers_count,
        openIssues: data.open_issues_count, url: data.html_url,
      }, provenance: { provider: 'github', operation: 'research',
        reference: 'repo:' + repo.toLowerCase() + ':' + data.id } };
    },
    operations: async ({ inputs, objective }) => {
      if (!approvedIssue || !plain(inputs) || inputs.action !== ISSUE_ACTION ||
          !approvedPayload({ id: approvedIssue.requestId, objective, capability: 'operations', inputs },
            approvedIssue)) fail();
      const repo = allowedRepo(inputs, allowedRepositories);
      if (!same(repo, approvedIssue.repository) || typeof inputs.title !== 'string' ||
          !inputs.title.trim() || inputs.title.length > 120 ||
          !(inputs.body === undefined ||
            (typeof inputs.body === 'string' && inputs.body.length <= 2048))) fail();
      const data = await github({ fetchImpl, token, repo,
        issue: { title: inputs.title, body: inputs.body ?? '' } });
      if (!Number.isSafeInteger(data.number) || data.number < 1 ||
          data.html_url !== 'https://github.com/' + repo + '/issues/' + data.number) fail();
      return { ok: true, output: { issueNumber: data.number, url: data.html_url },
        provenance: { provider: 'github', operation: 'operations',
          reference: 'issue:' + repo.toLowerCase() + ':' + data.number } };
    },
  };
  const host = { handlers, grants, approvedEffects: approvedIssue ? ['operations'] : [],
    allowTaskWrites: durableProject !== null };
  return Object.freeze({
    async execute(request) {
      // Only the trusted host config enables tracing; request fields cannot.
      const enforcing = traceMode === 'enforced';
      const events = [];
      const step = name => { if (enforcing) events.push(name); };
      const blocked = reply => enforcing ?
        { ...reply, execution: null, trace: blockedExecutionTrace(events) } : reply;
      const safeRequest = snapshotRequest(request);
      if (!plain(safeRequest) ||
          typeof safeRequest.objective !== 'string' || !safeRequest.objective.trim() ||
          safeRequest.objective.length > 16384) {
        step('request.rejected');
        return blocked({ status: 'invalid_request', audit: { status: 'not_requested' } });
      }
      step('request.accepted');
      // Approval is bound to one request ID and action before any handler call.
      if (approvedIssue && routeObjective(safeRequest) === 'operations' &&
          !approvedPayload(safeRequest, approvedIssue)) {
        step('request.denied');
        return blocked({ status: 'denied', reason: 'effect_not_approved',
          audit: { status: 'not_requested' } });
      }
      return exclusive(durableProject, async () => {
        let audit = { status: 'not_requested' };
        if (auditMode === 'required') {
          try {
            // Only the actual PP-0004 issuer can return a confirmed audit.
            const receipt = await issueUsageReceipt({
              sourceRepository, storeRepository: auditRepository,
              token, fetchImpl: auditTransport === 'simulation' ?
                auditFetchImpl : globalThis.fetch,
            });
            if (!verifyReceipt(receipt, auditRepository)) fail();
            if (auditTransport === 'simulation') {
              // Simulated receipts never permit provider execution or release.
              step('audit.unverified');
              return blocked({ status: 'audit_unverified', audit: { status: 'simulated' },
                execution: null });
            }
            audit = { status: 'confirmed', receiptUrl: receipt.receiptUrl,
              receiptCommit: receipt.receiptCommit, sourceCommit: receipt.sourceCommit };
            step('audit.confirmed');
          } catch {
            step('audit.failed');
            return blocked({ status: 'audit_failed', audit: { status: 'failed' },
              execution: null });
          }
        } else step('audit.not_required');
        try {
          const selected=routeObjective(safeRequest);
          step('route.selected');
          let called=0,returned=0,dispatched=null;
          // Wrap only trusted configured handlers; do not grant new capabilities.
          const checkedHost = enforcing ? { ...host, handlers: Object.fromEntries(
            Object.entries(handlers).map(([key,fn]) => [key, async args => {
              called++;
              dispatched=key;
              step('handler.started');
              try {
                const reply=await fn(args);
                returned++;
                step('handler.returned');
                return reply;
              } catch(e) { step('handler.failed'); throw e; }
            }])) } : host;
          const result = await runGateway({ request: safeRequest, host: checkedHost,
            tracking: durableProject === null ? { mode: 'ephemeral' } : {
              mode: 'durable', projectRoot: durableProject, secret: durableSecret,
            } });
          if (!enforcing) return { ...result, audit };
          if (result.status !== 'completed') return blocked({ ...result, audit });
          if (called!==1 || returned!==1 || dispatched!==selected)
            return blocked({ status:'execution_gate_failed', audit });
          step('output.validated');
          try {
            const trace=releaseExecutionTrace({steps:events,route:selected,dispatched,
              result,audit,requiredAudit:auditMode==='required'});
            const response={...result,audit,trace};
            if (!verifyReleasedExecution(response)) fail();
            return response;
          } catch {
            step('release.denied');
            return blocked({ status:'execution_gate_failed', audit });
          }
        } catch {
          // If a durable provider may already have been called, never auto-retry.
          step('gateway.failed');
          return blocked({ status: durableProject ? 'needs_reconciliation' : 'invalid_request',
            execution: null, audit });
        }
      });
    },
  });
}
