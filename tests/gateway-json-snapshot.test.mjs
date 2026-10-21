import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, loadProject } from '../src/core.mjs';
import { runGateway } from '../src/gateway.mjs';

const ID = '8a0dc3bd-e94f-427a-a277-aaabf621047b';
const request = { id: ID, objective: 'Perform the authorized host operation', capability: 'operations' };
function host(response) {
  return {
    handlers: { operations: async () => response },
    grants: ['operations'], approvedEffects: ['operations'], allowTaskWrites: true,
  };
}
function reply(output) {
  return { ok: true, output, provenance: {
    provider: 'trustedhost', operation: 'operations', reference: 'operation:123',
  } };
}
async function run(output) {
  return runGateway({ request, host: host(reply(output)) });
}

test('second review P2: reject nested NaN, Infinity and negative-zero rather than silently changing numbers', async () => {
  for (const output of [
    { value: Infinity }, { value: NaN }, { value: -Infinity },
    { nested: [{ value: Infinity }] }, { zero: -0 },
  ]) {
    const response = await run(output);
    assert.equal(response.status, 'unverified_execution');
    assert.equal(response.execution, null);
  }
});

test('second review P2: reject nested undefined/functions/symbols instead of omitting fields', async () => {
  for (const output of [
    { value: undefined }, { value: () => 5 }, { value: Symbol('private') },
    { nested: [{ omitted: undefined }] }, [1, undefined],
    (() => { const array = [1, 2]; delete array[0]; return array; })(),
  ]) {
    const response = await run(output);
    assert.equal(response.status, 'unverified_execution');
    assert.equal(response.execution, null);
  }
});

test('second review P2: reject Map, Error, class instances, accessors and stateful toJSON', async () => {
  const getter = {};
  Object.defineProperty(getter, 'value', { enumerable: true, get() {
    throw Error('Getter must not execute');
  } });
  let serialized = 0;
  const toJSON = { n: 0, toJSON() { serialized++; return ++this.n === 1 ? { acknowledged: true } : undefined; } };
  for (const output of [
    new Map([['confirmed', false]]),
    { nested: new Error('execution failed') },
    new Date(),
    new (class Opaque { constructor() { this.secret = 'no'; } })(),
    getter, toJSON,
  ]) {
    const response = await run(output);
    assert.equal(response.status, 'unverified_execution');
    assert.equal(response.execution, null);
  }
  assert.equal(serialized, 0);
});

test('second review P2: reject non-enumerable, symbol and inherited output fields', async () => {
  const hidden = { confirmed: true };
  Object.defineProperty(hidden, 'hidden', { value: 'sensitive', enumerable: false });
  const symbolKey = { confirmed: true, [Symbol('secret')]: 'sensitive' };
  const inherited = Object.create({ confirmed: false });
  inherited.message = 'yes';
  for (const output of [hidden, symbolKey, inherited]) {
    const response = await run(output);
    assert.equal(response.status, 'unverified_execution');
  }
});

test('second review P2: snapshot is detached from mutable response and matches JSON wire representation', async () => {
  const original = { nested: { acknowledged: true, count: 2 }, list: [1, 'two', null] };
  const response = await run(original);
  assert.equal(response.status, 'completed');
  const before = JSON.stringify(response);
  original.nested.count = Infinity;
  original.nested.acknowledged = false;
  original.list.push(() => 'dropped');
  assert.equal(JSON.stringify(response), before);
  assert.deepEqual(response.execution.output, { nested: { acknowledged: true, count: 2 }, list: [1, 'two', null] });
  assert.equal(response.execution.provenance.operation, 'operations');
});

test('second review P2: durable external-effect invalid results remain ambiguous, never completed or automatically rerun', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pp-json-security-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, 'Durable output verification');
  let effects = 0;
  const invalid = { ok: true, output: { value: Infinity }, provenance: {
    provider: 'trustedhost', operation: 'operations',
  } };
  const supplied = host(invalid);
  supplied.handlers.operations = async () => { effects++; return invalid; };
  const tracking = { mode: 'durable', projectRoot: root,
    secret: 'a-host-managed-test-secret-12345678' };
  const once = await runGateway({ request, host: supplied, tracking });
  assert.equal(once.status, 'unverified_execution');
  assert.equal(once.tracking.runState, 'ambiguous');
  const state = (await loadProject(root)).state;
  assert.equal(state.tasks[0].gatewayRun, 'ambiguous');
  assert.equal(state.tasks[0].status, 'in_progress');
  const retry = await runGateway({ request, host: supplied,
    tracking: { ...tracking, retryApproved: true } });
  assert.equal(retry.status, 'needs_reconciliation');
  assert.equal(effects, 1);
});

test('second review P2: explicit JSON acknowledgement succeeds; absent acknowledgement does not', async () => {
  const good = await run({ acknowledged: true });
  assert.equal(good.status, 'completed');
  assert.equal(good.execution.output.acknowledged, true);
  const absent = await run(undefined);
  assert.equal(absent.status, 'unverified_execution');
});
