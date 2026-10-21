import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, loadProject } from '../src/core.mjs';
import { runGateway } from '../src/gateway.mjs';

const ID = '8a0dc3bd-e94f-427a-a277-aaabf621047b';
const request = { id: ID, objective: 'Perform the authorized host operation',
  capability: 'operations' };
const hostFor = fn => ({ handlers: { operations: fn }, grants: ['operations'],
  approvedEffects: ['operations'], allowTaskWrites: true });
const outcome = p => ({ ok: true, output: { acknowledged: true },
  provenance: p });
const expected = { provider: 'trustedhost', operation: 'operations',
  reference: 'effect:verification-123' };
const invoke = p => runGateway({ request, host: hostFor(async () => outcome(p)) });

test('third review P2: changing provider getter cannot create completed without provider identity', async () => {
  let accesses = 0;
  const unstable = { get provider() {
    accesses++;
    return accesses <= 2 ? 'trustedhost' : undefined;
  }, operation: 'operations' };
  const response = await invoke(unstable);
  assert.equal(response.status, 'unverified_execution');
  assert.equal(response.execution, null);
  assert.equal(accesses, 0, 'accessor must not execute during verification');
  assert.equal(JSON.stringify(response).includes('"provider"'), false);
});

test('third review P2: changing reference getter cannot pass review then disappear on the wire', async () => {
  let accesses = 0;
  const unstable = { provider: 'trustedhost', operation: 'operations',
    get reference() { return ++accesses < 3 ? 'effect:1' : undefined; } };
  const response = await invoke(unstable);
  assert.equal(response.status, 'unverified_execution');
  assert.equal(response.execution, null);
  assert.equal(accesses, 0);
});

test('third review P2: reject invalid, inherited, accessor, foreign-prototype and proxy provenance', async () => {
  const inherited = Object.create(expected);
  const hidden = { operation: 'operations', reference: 'effect:123' };
  Object.defineProperty(hidden, 'provider', { value: 'trustedhost', enumerable: false });
  const extra = { ...expected, extra: 'unaudited metadata' };
  const getter = { ...expected };
  Object.defineProperty(getter, 'operation', { enumerable: true,
    get() { throw Error('Secret must not be read'); } });
  const throwingProxy = new Proxy({ ...expected }, { ownKeys() { throw Error('Proxy denied'); } });
  for (const invalid of [
    inherited, hidden, extra, getter, throwingProxy,
    { ...expected, provider: undefined },
    { ...expected, provider: 'Forbidden Uppercase' },
    { ...expected, operation: 'shell.exec' },
    { ...expected, reference: 42 },
    { ...expected, reference: '' },
    { ...expected, reference: 'x'.repeat(1025) },
    new Map([['provider', 'trustedhost']]),
    Object.assign(new (class Provenance {}), expected),
  ]) {
    const response = await invoke(invalid);
    assert.equal(response.status, 'unverified_execution');
    assert.equal(response.execution, null);
  }
});

test('third review P2: mutable provenance and mutable envelope cannot rewrite validated response', async () => {
  const provenance = { ...expected };
  const source = outcome(provenance);
  const response = await runGateway({ request, host: hostFor(async () => source) });
  assert.equal(response.status, 'completed');
  const snapshot = JSON.stringify(response);
  provenance.provider = undefined;
  provenance.reference = Infinity;
  source.ok = false;
  source.output = { acknowledged: false };
  assert.equal(JSON.stringify(response), snapshot);
  assert.deepEqual(response.execution.provenance, expected);
  assert.equal(response.execution.output.acknowledged, true);
});

test('third review P2: reject an accessor at reply envelope instead of trusting fluctuating metadata', async () => {
  let accesses = 0;
  const source = { ok: true, output: { acknowledged: true },
    get provenance() { accesses++; return expected; } };
  const response = await runGateway({ request, host: hostFor(async () => source) });
  assert.equal(response.status, 'unverified_execution');
  assert.equal(response.execution, null);
  assert.equal(accesses, 0);
});

test('third review P2: durable external side effect with unstable provenance cannot mark completed or retry', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pp-provenance-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, 'Provenance identity review');
  let effects = 0, accesses = 0;
  const unstable = { get provider() {
    accesses++; return accesses <= 2 ? 'trustedhost' : undefined;
  }, operation: 'operations' };
  const activeHost = hostFor(async () => { effects++; return outcome(unstable); });
  const tracking = { mode: 'durable', projectRoot: root,
    secret: 'a-host-managed-secret-for-review-regression' };
  const first = await runGateway({ request, host: activeHost, tracking });
  assert.equal(first.status, 'unverified_execution');
  assert.equal(first.tracking.runState, 'ambiguous');
  assert.equal(accesses, 0);
  assert.equal((await loadProject(root)).state.tasks[0].gatewayRun, 'ambiguous');
  const repeat = await runGateway({ request, host: activeHost,
    tracking: { ...tracking, retryApproved: true } });
  assert.equal(repeat.status, 'needs_reconciliation');
  assert.equal(effects, 1);
});

test('third review P2: normal bounded plain metadata remains a verifiable host assertion', async () => {
  const response = await invoke(expected);
  assert.equal(response.status, 'completed');
  assert.deepEqual(response.execution.provenance, expected);
  assert.equal(JSON.parse(JSON.stringify(response)).execution.provenance.provider, 'trustedhost');
});
