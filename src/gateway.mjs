// PP-0005: Host-invoked gateway. Task data never grants tools or shell authority.
import { createHmac } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addTask, loadProject, saveState, startTask } from './core.mjs';

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

function publicTracking(task, state = 'durable') {
  return { mode: state, taskId: task.id, taskStatus: task.status, runState: task.gatewayRun };
}

async function prepareTracking(tracking, request, route) {
  if (!plain(tracking) || tracking.mode !== 'durable') return { mode: 'ephemeral' };
  if (!ID.test(request.id ?? '')) fail('Durable requests require a valid UUID request.id');
  if (typeof tracking.projectRoot !== 'string' || !tracking.projectRoot.trim()) fail('Durable tracking requires a project root');
  const root = await realpath(tracking.projectRoot);
  if (root === await realpath(FRAMEWORK_ROOT)) fail('Gateway requests cannot modify the Pro-Papa framework roadmap');
  const { state, profiles } = await loadProject(root);
  const mac = requestMac(tracking.secret, request, route);
  let task = state.tasks.find(t => t.gatewayRequest?.id === request.id);
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
      title: 'Gateway request ' + request.id.slice(0, 8),
      objective: 'Execute approved host request without persisting its private text',
      profile: CAPABILITIES[route].profile,
      acceptance: ['Verify real authorized handler execution and output',
        'Record genuine evidence and obtain independent validation before task closure'],
    });
    task.gatewayRequest = { id: request.id, mac, capability: route };
    task.gatewayRun = 'queued';
  }
  const other = state.tasks.some(t => t.status === 'in_progress' && t.id !== task.id);
  if (other) {
    await saveState(root, state, profiles);
    return { mode: 'existing', task, reason: 'queued_behind_active_task' };
  }
  if (task.status === 'pending') startTask(state, task.id, 'gateway-host');
  if (task.status !== 'in_progress') return { mode: 'existing', task, reason: 'task_not_resumable' };
  task.gatewayRun = 'executing'; // Reserve before invoking a potentially side-effecting tool.
  await saveState(root, state, profiles);
  return { mode: 'durable', root, taskId: task.id };
}

async function settleTracking(tracking, outcome) {
  if (tracking.mode !== 'durable') return { mode: 'ephemeral' };
  try {
    const { state, profiles } = await loadProject(tracking.root);
    const task = state.tasks.find(t => t.id === tracking.taskId);
    if (!task || task.gatewayRun !== 'executing') return { mode: 'durable', taskId: tracking.taskId, runState: 'needs_reconciliation' };
    task.gatewayRun = outcome === 'completed' ? 'completed' : outcome === 'provider_unavailable' ? 'retryable' : 'ambiguous';
    await saveState(tracking.root, state, profiles);
    return publicTracking(task);
  } catch {
    // Provider side effects may already exist: NEVER automatically repeat them.
    return { mode: 'durable', taskId: tracking.taskId, runState: 'needs_reconciliation' };
  }
}

function validProvenance(p, capability) {
  return plain(p) && typeof p.provider === 'string' && NAME.test(p.provider) &&
    p.operation === capability && (p.reference === undefined ||
      (typeof p.reference === 'string' && p.reference.length > 0 && p.reference.length <= 1024));
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
    if (plain(reply) && reply.ok === true && validProvenance(reply.provenance, capability)) {
      status = 'completed';
      result = { output: reply.output, provenance: reply.provenance };
    } else if (plain(reply) && reply.ok === true) status = 'unverified_execution';
  } catch {
    // Tool exception messages may contain secret data; never log/return them.
    status = 'provider_unavailable';
  }
  const persisted = await settleTracking(prepared, status);
  let audit = { status: 'not_requested' };
  if (host.audit === true) {
    audit = { status: 'failed' };
    try {
      if (typeof host.receiptIssuer === 'function') {
        const receipt = await host.receiptIssuer();
        if (receipt?.status === 'confirmed' &&
          typeof receipt.receiptUrl === 'string' &&
          /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[a-f0-9]{40}\//.test(receipt.receiptUrl) &&
          /^[a-f0-9]{40}$/.test(receipt.receiptCommit ?? '')) {
          audit = { status: 'confirmed', receiptUrl: receipt.receiptUrl,
            receiptCommit: receipt.receiptCommit };
        }
      }
    } catch { /* No false confirmation; execution may already have occurred. */ }
  }
  return { status, capability, suggestedRoute: route, tracking: persisted,
    execution: result ?? null, audit };
}
