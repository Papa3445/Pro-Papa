import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, loadProject } from '../src/core.mjs';
import { runGateway } from '../src/gateway.mjs';

const ID = '8a0dc3bd-e94f-427a-a277-aaabf621047b';
const SECRET = 'a-long-host-managed-secret-for-local-test';
const COMMIT_A = 'a'.repeat(40);
const COMMIT_B = 'b'.repeat(40);
async function makeProject(t, label) {
  const root = await mkdtemp(join(tmpdir(), 'pp-gateway-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, label);
  return root;
}
const handler = (capability, action, external = false) => ({
  handlers: { [capability]: action },
  grants: [capability],
  ...(external ? { approvedEffects: [capability] } : {}),
  allowTaskWrites: true,
});
const tracked = root => ({ mode: 'durable', projectRoot: root, secret: SECRET });
const request = (id = ID, capability = 'general') =>
  ({ id, capability, objective: 'Handle the same private host request' });
const success = cap => ({ ok: true, output: { acknowledged: true },
  provenance: { provider: 'testhost', operation: cap } });

test('P1: symlinked .pro-papa metadata cannot modify another project task ledger', async t => {
  const user = await makeProject(t, 'User project');
  const other = await makeProject(t, 'Protected reference project');
  const original = await readFile(join(other, '.pro-papa/tasks.json'), 'utf8');
  await rm(join(user, '.pro-papa'), { recursive: true });
  await symlink(join(other, '.pro-papa'), join(user, '.pro-papa'), 'dir');
  let calls = 0;
  await assert.rejects(runGateway({
    request: request(),
    host: handler('general', async () => { calls++; return success('general'); }),
    tracking: tracked(user),
  }), /metadata|unaliased/);
  assert.equal(calls, 0);
  assert.equal(await readFile(join(other, '.pro-papa/tasks.json'), 'utf8'), original);
});

test('P1: symlinked tasks.json file cannot act as aliased project ledger', async t => {
  const user = await makeProject(t, 'User project');
  const other = await makeProject(t, 'Protected ledger');
  const target = join(other, '.pro-papa/tasks.json');
  const original = await readFile(target, 'utf8');
  await rm(join(user, '.pro-papa/tasks.json'));
  await symlink(target, join(user, '.pro-papa/tasks.json'), 'file');
  let calls = 0;
  await assert.rejects(runGateway({
    request: request(),
    host: handler('general', async () => { calls++; return success('general'); }),
    tracking: tracked(user),
  }), /metadata|unaliased/);
  assert.equal(calls, 0);
  assert.equal(await readFile(target, 'utf8'), original);
});

test('P2: uppercase and lowercase UUID retries are identical for external effects', async t => {
  const root = await makeProject(t, 'Durable UUID case regression');
  let calls = 0;
  const host = handler('operations', async () => {
    calls++; return success('operations');
  }, true);
  const lower = await runGateway({ request: request(ID, 'operations'),
    host, tracking: tracked(root) });
  assert.equal(lower.status, 'completed');
  const upper = await runGateway({ request: request(ID.toUpperCase(), 'operations'),
    host, tracking: tracked(root) });
  assert.equal(upper.status, 'already_executed');
  assert.equal(calls, 1);
  const state = (await loadProject(root)).state;
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].gatewayRequest.id, ID);
});

function receipt(overrides = {}) {
  return {
    status: 'confirmed', receiptCommit: COMMIT_A,
    receiptUrl: 'https://github.com/x/private-audit/blob/' + COMMIT_A +
      '/usage-receipts/2026/10/' + ID + '.json',
    storeRepository: 'x/private-audit', visibility: 'private', receiptId: ID,
    sourceCommit: COMMIT_B,
    consulted: [
      { path: 'AGENTS.md', gitBlobSha: COMMIT_B },
      { path: '.pro-papa/profiles.json', gitBlobSha: COMMIT_B },
    ],
    ...overrides,
  };
}
async function auditFromStub(value, expectedAuditStore = 'x/private-audit') {
  return runGateway({
    request: request(),
    host: {
      ...handler('general', async () => success('general')),
      audit: true, expectedAuditStore,
      receiptIssuer: async () => value,
    },
  });
}

test('P2: mismatched receipt URL commit, wrong store, fake path and missing readback cannot confirm', async () => {
  const cases = [
    receipt({ receiptCommit: COMMIT_B }),
    receipt({ storeRepository: 'attacker/public' }),
    receipt({ receiptUrl: 'https://github.com/x/private-audit/blob/' +
      COMMIT_A + '/fake-path/' + ID + '.json' }),
    receipt({ receiptUrl: 'https://github.com/attacker/private-audit/blob/' +
      COMMIT_A + '/usage-receipts/2026/10/' + ID + '.json' }),
    receipt({ visibility: 'public' }),
    receipt({ receiptId: undefined }),
    receipt({ consulted: undefined }),
    receipt({ sourceCommit: undefined }),
  ];
  for (const item of cases) {
    const response = await auditFromStub(item);
    assert.equal(response.status, 'completed');
    assert.equal(response.audit.status, 'failed');
  }
  // Syntactically consistent third-party metadata still proves no GitHub readback.
  const claimed = await auditFromStub(receipt());
  assert.equal(claimed.status, 'completed');
  assert.equal(claimed.audit.status, 'host_asserted');
  assert.notEqual(claimed.audit.status, 'confirmed');
});

test('P3: no handler output, unserializable output and invalid acknowledgements cannot complete', async () => {
  for (const output of [
    undefined, () => 5, BigInt(9),
    (() => { const item = {}; item.self = item; return item; })(),
  ]) {
    const result = await runGateway({
      request: request(),
      host: handler('general', async () => ({
        ok: true, output, provenance: { provider: 'testhost', operation: 'general' },
      })),
    });
    assert.equal(result.status, 'unverified_execution');
    assert.equal(result.execution, null);
  }
  const defined = await runGateway({
    request: request(),
    host: handler('general', async () => success('general')),
  });
  assert.equal(defined.status, 'completed');
  assert.deepEqual(defined.execution.output, { acknowledged: true });
});
