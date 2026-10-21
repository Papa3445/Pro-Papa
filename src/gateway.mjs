// PP-0005: Host-invoked gateway. Task data never grants tools or shell authority.
import { createHmac } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addTask, loadProject, saveState, startTask } from './core.mjs';
import { issueUsageReceipt } from './usage-receipts.mjs';

const FRAMEWORK_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME = /^[a-z][a-z0-9.-]{0,63}$/;
const CAPABILITIES = Object.freeze({
  'text.metrics': Object.freeze({ profile: 'general', effect: 'read' }),
  'math.sum': Object.freeze({ profile: 'data', effect: 'read' }),
  general: Object.freeze({ profile: 'general', effect: 'read' }),
  research: Object.freeze({ profile: 'research', effect: 'read' }),
  software: Object.freeze({ profile: 'software', effect: 'external' }),
  document: Object.freeze({ profile: 'document', effect: 'external' }),
  data: Object.freeze({ profile: 'data', effect: 'read' }),
  operations: Object.freeze({ profile: 'operations', effect: 'external' }),
});
export const GATEWAY_CAPABILITIES = CAPABILITIES;
const fail = (message) => { throw new Error(message); };
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fixed = s => typeof s === 'string' && s.trim() && s.length <= 16384;

export function routeObjective(request) {
  if (!plain(request) || !fixed(request.objective)) fail('A nonempty objective up to 16384 characters is required');
  // Route hints are data only. Neither hints nor the objective grant a capability.
  const suggested = request.capability;
  if (typeof suggested === 'string' && Object.hasOwn(CAPABILITIES, suggested)) return suggested;
  const category = request.category;
  if (typeof category === 'string' && Object.hasOwn(CAPABILITIES, category)) return category;
  const text = request.objective.toLowerCase();
  if (/\b(research|investigate|sources|citations)\b/.test(text)) return 'research';
  if (/\b(code|program|debug|software)\b/.test(text)) return 'software';
  if (/\b(document|draft|letter|memo)\b/.test(text)) return 'document';
  if (/\b(calculate|forecast|analyze data|spreadsheet)\b/.test(text)) return 'data';
  if (/\b(plan|workflow|schedule|coordinate)\b/.test(text)) return 'operations';
  return 'general';
}

function requestMac(secret, request, route) {
  if (typeof secret !== 'string' || secret.length < 16) fail('Durable tracking requires a host-managed secret of at least 16 characters');
  return createHmac('sha256', secret).update(JSON.stringify([
    request.objective, route, request.inputs ?? null,
  ])).digest('hex');
}


async function assertIsolatedProject(root) {
  const framework = await realpath(FRAMEWORK_ROOT);
  if (root === framework || root.startsWith(framework + sep) || framework.startsWith(root + sep)) {
    fail('Gateway requests cannot modify the Pro-Papa framework roadmap');
  }
  // Validate actual nested metadata paths, not just the enclosing project root.
  const metadata = resolve(root, '.pro-papa');
  const ledger = resolve(metadata, 'tasks.json');
  const [directory, file, actualMetadata, actualLedger] = await Promise.all([
    lstat(metadata), lstat(ledger), realpath(metadata), realpath(ledger),
  ]);
  if (!directory.isDirectory() || directory.isSymbolicLink() ||
      !file.isFile() || file.isSymbolicLink() ||
      actualMetadata !== metadata || actualLedger !== ledger ||
      file.nlink !== 1) {
    fail('Gateway project metadata must be real, unaliased files inside the separate project');
  }
}

async function saveIsolatedProject(root, state, profiles) {
  // Guards stable symlink aliases, not a hostile concurrent filesystem TOCTOU race.
  await assertIsolatedProject(root);
  await saveState(root, state, profiles);
}

const GITHUB_RECEIPT_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([a-f0-9]{40})\/usage-receipts\/(\d{4})\/(\d{2})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/i;
function consistentReceipt(receipt, expectedStore) {
  if (!plain(receipt) || receipt.status !== 'confirmed' ||
      typeof receipt.receiptUrl !== 'string' || typeof expectedStore !== 'string') return false;
  const match = GITHUB_RECEIPT_URL.exec(receipt.receiptUrl);
  const store = match && match[1] + '/' + match[2];
  return Boolean(match) && store.toLowerCase() === expectedStore.toLowerCase() &&
    receipt.storeRepository?.toLowerCase() === expectedStore.toLowerCase() &&
    receipt.receiptCommit === match[3] && receipt.receiptId?.toLowerCase() === match[6].toLowerCase() &&
    receipt.visibility === 'private' &&
    typeof receipt.sourceCommit === 'string' && /^[a-f0-9]{40}$/.test(receipt.sourceCommit) &&
    Array.isArray(receipt.consulted) && receipt.consulted.length === 2 &&
    ['AGENTS.md', '.pro-papa/profiles.json'].every(path =>
      receipt.consulted.some(item => item.path === path && /^[a-f0-9]{40}$/.test(item.gitBlobSha)));
}

// Create a detached, JSON-exact output snapshot. Plain JSON structures only:
// JSON.stringify by itself silently drops undefined/functions, converts NaN to
// null, serializes Map/Error as {}, and may invoke stateful toJSON methods.
function snapshotOutput(output) {
  const seen = new Set();
  let nodes = 0;
  function copy(value, depth) {
    if (++nodes > 10000 || depth > 64) fail('Handler output exceeds JSON structure limits');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
    if (typeof value !== 'object') fail('Handler output contains non-JSON data');
    if (seen.has(value)) fail('Handler output contains repeated or cyclic object references');
    seen.add(value);
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype :
        prototype !== Object.prototype && prototype !== null) {
      fail('Handler output contains a non-JSON object');
    }
    const properties = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(properties);
    if (keys.some(key => typeof key !== 'string')) fail('Handler output contains symbol keys');
    if (array) {
      const length = value.length;
      if (length > 10000 || keys.length !== length + 1)
        fail('Handler output contains array holes or additional properties');
      const result = [];
      for (let i = 0; i < length; i++) {
        const descriptor = properties[String(i)];
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
          fail('Handler output contains array holes or accessors');
        result.push(copy(descriptor.value, depth + 1));
      }
      return result;
    }
    const result = Object.create(null);
    for (const key of keys) {
      const descriptor = properties[key];
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
        fail('Handler output contains non-enumerable properties or getters');
      Object.defineProperty(result, key, {
        enumerable: true, configurable: true, writable: true,
        value: copy(descriptor.value, depth + 1),
      });
    }
    return result;
  }
  try {
    const validated = copy(output, 0);
    const wire = JSON.stringify(validated);
    if (typeof wire !== 'string' || Buffer.byteLength(wire, 'utf8') > 256 * 1024)
      return { valid: false };
    return { valid: true, output: JSON.parse(wire) };
  } catch {
    return { valid: false };
  }
}

function publicTracking(task, state = 'durable') {
  return { mode: state, taskId: task.id, taskStatus: task.status, runState: task.gatewayRun };
}

async function prepareTracking(tracking, request, route) {
  if (!plain(tracking) || tracking.mode !== 'durable') return { mode: 'ephemeral' };
  if (!ID.test(request.id ?? '')) fail('Durable requests require a valid UUID request.id');
  if (typeof tracking.projectRoot !== 'string' || !tracking.projectRoot.trim()) fail('Durable tracking requires a project root');
  const root = await realpath(tracking.projectRoot);
  await assertIsolatedProject(root);
  const { state, profiles } = await loadProject(root);
  const normalizedId = request.id.toLowerCase();
  const mac = requestMac(tracking.secret, request, route);
  let task = state.tasks.find(t => t.gatewayRequest?.id?.toLowerCase() === normalizedId);
  if (task && (task.gatewayRequest.mac !== mac || task.gatewayRequest.capability !== route)) {
    return { mode: 'denied', reason: 'idempotency_key_conflict' };
  }
  if (task?.gatewayRun === 'completed') return { mode: 'existing', task, reason: 'already_executed' };
  if (task && ['executing', 'ambiguous'].includes(task.gatewayRun)) {
    return { mode: 'existing', task, reason: 'needs_reconciliation' };
  }
  if (task?.gatewayRun === 'retryable' && tracking.retryApproved !== true) {
    return { mode: 'existing', task, reason: 'retry_requires_host_authorization' };
  }
  if (task?.gatewayRun === 'retryable' && CAPABILITIES[route].effect !== 'read') {
    return { mode: 'existing', task, reason: 'non_idempotent_retry_requires_reconciliation' };
  }
  if (!task) {
    task = addTask(state, profiles, {
      title: 'Gateway request ' + normalizedId.slice(0, 8),
      objective: 'Execute approved host request without persisting its private text',
      profile: CAPABILITIES[route].profile,
      acceptance: ['Verify real authorized handler execution and output',
        'Record genuine evidence and obtain independent validation before task closure'],
    });
    task.gatewayRequest = { id: normalizedId, mac, capability: route };
    task.gatewayRun = 'queued';
  }
  const other = state.tasks.some(t => t.status === 'in_progress' && t.id !== task.id);
  if (other) {
    await saveIsolatedProject(root, state, profiles);
    return { mode: 'existing', task, reason: 'queued_behind_active_task' };
  }
  if (task.status === 'pending') startTask(state, task.id, 'gateway-host');
  if (task.status !== 'in_progress') return { mode: 'existing', task, reason: 'task_not_resumable' };
  task.gatewayRun = 'executing'; // Reserve before invoking a potentially side-effecting tool.
  await saveIsolatedProject(root, state, profiles);
  return { mode: 'durable', root, taskId: task.id };
}

async function settleTracking(tracking, outcome) {
  if (tracking.mode !== 'durable') return { mode: 'ephemeral' };
  try {
    await assertIsolatedProject(tracking.root);
    const { state, profiles } = await loadProject(tracking.root);
    const task = state.tasks.find(t => t.id === tracking.taskId);
    if (!task || task.gatewayRun !== 'executing') return { mode: 'durable', taskId: tracking.taskId, runState: 'needs_reconciliation' };
    task.gatewayRun = outcome === 'completed' ? 'completed' : outcome === 'provider_unavailable' ? 'retryable' : 'ambiguous';
    await saveIsolatedProject(tracking.root, state, profiles);
    return publicTracking(task);
  } catch {
    // Provider side effects may already exist: NEVER automatically repeat them.
    return { mode: 'durable', taskId: tracking.taskId, runState: 'needs_reconciliation' };
  }
}

// Snapshot provider identity once. Accessor-based or non-plain provenance must
// never be validated under one value and later re-read as another.
function snapshotProvenance(source, capability) {
  try {
    if (!plain(source)) return { valid: false };
    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null) return { valid: false };
    const fields = Object.getOwnPropertyDescriptors(source);
    const keys = Reflect.ownKeys(fields);
    if (keys.some(key => typeof key !== 'string' ||
      !['provider', 'operation', 'reference'].includes(key))) return { valid: false };
    const provider = fields.provider;
    const operation = fields.operation;
    const reference = fields.reference;
    if (!provider || !operation ||
        !provider.enumerable || !operation.enumerable ||
        !Object.hasOwn(provider, 'value') || !Object.hasOwn(operation, 'value') ||
        typeof provider.value !== 'string' || !NAME.test(provider.value) ||
        operation.value !== capability) return { valid: false };
    if (reference && (!reference.enumerable || !Object.hasOwn(reference, 'value') ||
        typeof reference.value !== 'string' || reference.value.length === 0 ||
        reference.value.length > 1024)) return { valid: false };
    return { valid: true, provenance: {
      provider: provider.value, operation: capability,
      ...(reference ? { reference: reference.value } : {}),
    } };
  } catch {
    // Proxy traps may throw; never treat an uninspectable host value as evidence.
    return { valid: false };
  }
}

// Inspect the handler reply envelope without triggering getters. The execution
// result is composed only of validated, detached output and provenance snapshots.
function snapshotReply(reply, capability) {
  try {
    if (!plain(reply)) return { valid: false };
    const prototype = Object.getPrototypeOf(reply);
    if (prototype !== Object.prototype && prototype !== null) return { valid: false };
    const fields = Object.getOwnPropertyDescriptors(reply);
    const success = fields.ok;
    if (!success || !success.enumerable || !Object.hasOwn(success, 'value') ||
        success.value !== true) return { valid: false };
    const output = fields.output;
    const provenance = fields.provenance;
    if (!output || !provenance || !output.enumerable || !provenance.enumerable ||
        !Object.hasOwn(output, 'value') || !Object.hasOwn(provenance, 'value')) {
      return { valid: false };
    }
    const checkedOutput = snapshotOutput(output.value);
    const checkedProvenance = snapshotProvenance(provenance.value, capability);
    if (!checkedOutput.valid || !checkedProvenance.valid) return { valid: false };
    return { valid: true, execution: {
      output: checkedOutput.output, provenance: checkedProvenance.provenance,
    } };
  } catch {
    return { valid: false };
  }
}

export async function runGateway({ request, host = {}, tracking = { mode: 'ephemeral' } }) {
  const route = routeObjective(request);
  const handlers = plain(host.handlers) ? host.handlers : {};
  const grants = Array.isArray(host.grants) ? host.grants : [];
  const authorizedEffects = Array.isArray(host.approvedEffects) ? host.approvedEffects : [];
  const capability = Object.hasOwn(handlers, route) ? route : 'general';
  const definition = CAPABILITIES[capability];
  if (!definition || typeof handlers[capability] !== 'function') {
    return { status: 'unsupported', suggestedRoute: route, capability: null, audit: { status: 'not_requested' } };
  }
  if (!grants.includes(capability) ||
    (definition.effect === 'external' && !authorizedEffects.includes(capability))) {
    return { status: 'denied', reason: 'host_permission_required', capability,
      audit: { status: 'not_requested' } };
  }
  if (plain(tracking) && tracking.mode === 'durable' && host.allowTaskWrites !== true) {
    return { status: 'denied', reason: 'tasks_write_permission_required', capability,
      audit: { status: 'not_requested' } };
  }

  const prepared = await prepareTracking(tracking, request, capability);
  if (prepared.mode === 'denied') return { status: 'denied', reason: prepared.reason, capability };
  if (prepared.mode === 'existing') return { status: prepared.reason, capability,
    tracking: publicTracking(prepared.task), audit: { status: 'not_requested' } };

  let status = 'provider_unavailable';
  let result;
  try {
    const reply = await handlers[capability]({
      objective: request.objective, inputs: request.inputs, capability,
    });
    const checked = snapshotReply(reply, capability);
    if (checked.valid) {
      status = 'completed';
      result = checked.execution;
    } else if (plain(reply)) {
      // A handler returned an unverifiable value; external effects may exist.
      status = 'unverified_execution';
    }
  } catch {
    // Tool exception messages may contain secret data; never log/return them.
    status = 'provider_unavailable';
  }
  const persisted = await settleTracking(prepared, status);
  let audit = { status: 'not_requested' };
  if (host.audit === true) {
    audit = { status: 'failed' };
    try {
      if (plain(host.pp0004Options)) {
        // This code invokes the verified PP-0004 issuer directly: actual GitHub
        // source reads, private-store write, commit-pinned readback and visibility checks.
        const sourceRepository = host.pp0004Options.sourceRepository;
        const storeRepository = host.pp0004Options.storeRepository;
        const receipt = await issueUsageReceipt({ sourceRepository, storeRepository });
        if (consistentReceipt(receipt, storeRepository)) {
          audit = { status: 'confirmed', receiptUrl: receipt.receiptUrl,
            receiptCommit: receipt.receiptCommit };
        }
      } else if (typeof host.receiptIssuer === 'function') {
        // External host callbacks cannot establish provider-backed readback here.
        // Even consistent metadata is only an assertion from the injected host.
        const receipt = await host.receiptIssuer();
        if (consistentReceipt(receipt, host.expectedAuditStore)) {
          audit = { status: 'host_asserted', receiptUrl: receipt.receiptUrl,
            receiptCommit: receipt.receiptCommit };
        }
      }
    } catch { /* No false confirmation; execution may already have occurred. */ }
  }
  return { status, capability, suggestedRoute: route, tracking: persisted,
    execution: result ?? null, audit };
}
