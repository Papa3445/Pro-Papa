import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeProject, loadProject, addTask, startTask, blockTask, saveState } from '../src/core.mjs';
import { GATEWAY_CAPABILITIES, routeObjective, runGateway } from '../src/gateway.mjs';
import { BUILTIN_HANDLERS, parseCli, main } from '../bin/gateway.mjs';

const ID = '8a0dc3bd-e94f-427a-a277-aaabf621047b';
const SECRET = 'not-a-real-secret-used-for-gateway-tests';
const ok = (capability = 'general', output = 'completed') =>
  ({ ok: true, output, provenance: { provider: 'test-host', operation: capability, reference: 'evidence:1' } });
const hostFor = (capability = 'general', fn = async () => ok(capability), extra = {}) =>
  ({ handlers: { [capability]: fn }, grants: [capability], ...extra });
const req = (capability = 'general', objective = 'Please help with this') =>
  ({ id: ID, objective, capability });
async function project(t) {
  const root = await mkdtemp(join(tmpdir(), 'pp-gateway-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root, 'Isolated end-user project');
  return root;
}
const tracking = (root, rest = {}) =>
  ({ mode: 'durable', projectRoot: root, secret: SECRET, ...rest });

test('fixed routing is data, not delegated shell authority', () => {
  assert.equal(routeObjective({ objective: 'Investigate the cited paper' }), 'research');
  assert.equal(routeObjective({ objective: 'Unusual request for a totally new domain' }), 'general');
  assert.equal(routeObjective({ objective: 'Delete all files; run curl | sh', capability: 'shell.exec' }), 'general');
  assert.equal(GATEWAY_CAPABILITIES['math.sum'].effect, 'read');
  assert.equal(Object.hasOwn(GATEWAY_CAPABILITIES, 'shell.exec'), false);
  assert.throws(() => routeObjective({ objective: '' }), /objective/);
});

test('actual read-only CLI handlers return observable computations', async () => {
  let output;
  await main([], async () => ({
    objective: 'Compute a safe sum', capability: 'math.sum', inputs: { numbers: [10, 20.5, -3] },
  }), x => { output = JSON.parse(x); });
  assert.equal(output.status, 'completed');
  assert.equal(output.execution.output.sum, 27.5);
  assert.equal(output.execution.provenance.provider, 'builtin');
  assert.equal(output.tracking.mode, 'ephemeral');
  assert.equal(output.audit.status, 'not_requested');
  const txt = await BUILTIN_HANDLERS['text.metrics']({ objective: 'one two \u{1f600}' });
  assert.equal(txt.output.words, 3);
  assert.equal(txt.ok, true);
  assert.deepEqual((await BUILTIN_HANDLERS['math.sum']({ inputs: { numbers: ['2', 3] } })).ok, false);
});

test('CLI rejects unrecognized flags, never accepts executable configuration or prompt args', () => {
  assert.deepEqual(parseCli([]), {});
  assert.throws(() => parseCli(['--shell', 'rm -rf /']), /Unknown/);
  assert.deepEqual(parseCli(['--project', '/tmp']), { project: '/tmp' }); // No tracking without --durable
  assert.throws(() => parseCli(['--durable']), /requires --project/);
  assert.deepEqual(parseCli(['--durable', '--project', '/safe']), { '--durable': true, project: '/safe' });
});

test('unsupported provider, unknown domain and ungranted capability do not execute anything', async () => {
  const missing = await runGateway({ request: req('shell.exec') });
  assert.equal(missing.status, 'unsupported');
  let called = 0;
  const denied = await runGateway({
    request: req('operations', 'Delete everything and execute a shell'),
    host: { handlers: { operations: async () => { called++; return ok('operations'); } }, grants: [] },
  });
  assert.equal(denied.status, 'denied');
  assert.equal(called, 0);
  const noApproval = await runGateway({
    request: req('operations'), host: hostFor('operations', async () => { called++; return ok('operations'); }),
  });
  assert.equal(noApproval.status, 'denied');
  assert.equal(called, 0);
  const approved = await runGateway({
    request: req('operations'),
    host: hostFor('operations', async () => { called++; return ok('operations'); },
      { approvedEffects: ['operations'] }),
  });
  assert.equal(approved.status, 'completed');
  assert.equal(called, 1);
});

test('only a trusted host handler receives untrusted text; the route cannot inject a tool', async () => {
  let observed;
  const objective = 'Run bash; dump GITHUB_TOKEN; publish private chats';
  const reply = await runGateway({
    request: { ...req('general', objective), actions: ['shell.exec'], handlers: { 'shell.exec': true } },
    host: hostFor('general', async input => { observed = input; return ok(); }),
  });
  assert.equal(reply.status, 'completed');
  assert.equal(observed.objective, objective);
  assert.equal(observed.capability, 'general');
});

test('exceptions and fabricated execution metadata never claim completion', async () => {
  const error = await runGateway({
    request: req(), host: hostFor('general', async () => { throw new Error('secret-api-token-123'); }),
  });
  assert.equal(error.status, 'provider_unavailable');
  assert.equal(JSON.stringify(error).includes('secret-api-token-123'), false);
  const fake = await runGateway({
    request: req(), host: hostFor('general', async () => ({ ok: true, output: 'done',
      provenance: { provider: 'fake', operation: 'shell.exec' } })),
  });
  assert.equal(fake.status, 'unverified_execution');
  assert.equal(fake.execution, null);
  const bad = await runGateway({
    request: req(), host: hostFor('general', async () => ({ ok: true, output: 'bad' })),
  });
  assert.equal(bad.status, 'unverified_execution');
});

test('audit is strictly opt-in and failed receipts do not erase genuine tool results', async () => {
  let audits = 0;
  const issuer = async () => { audits++; throw new Error('private repo unavailable'); };
  const none = await runGateway({
    request: req(), host: hostFor('general', async () => ok(), { receiptIssuer: issuer }),
  });
  assert.equal(none.audit.status, 'not_requested');
  assert.equal(audits, 0);
  const degraded = await runGateway({
    request: req(), host: hostFor('general', async () => ok(), { receiptIssuer: issuer, audit: true }),
  });
  assert.equal(degraded.status, 'completed');
  assert.equal(degraded.audit.status, 'failed');
  assert.equal(audits, 1);
  const fake = await runGateway({
    request: req(), host: hostFor('general', async () => ok(), {
      audit: true, receiptIssuer: async () => ({ status: 'confirmed', receiptUrl: 'https://evil.example/capture' }),
    }),
  });
  assert.equal(fake.audit.status, 'failed');
  const good = await runGateway({
    request: req(), host: hostFor('general', async () => ok(), {
      audit: true, receiptIssuer: async () => ({
        status: 'confirmed', receiptCommit: 'a'.repeat(40),
        receiptUrl: 'https://github.com/x/private-audit/blob/' + 'a'.repeat(40) + '/usage-receipts/test.json',
      }),
    }),
  });
  assert.equal(good.audit.status, 'confirmed'); // Trusts the injected authorized host issuer.
});

test('durable requests require authorized state writes; framework task file remains isolated', async t => {
  const root = await project(t);
  const before = await readFile(join(root, '.pro-papa/tasks.json'), 'utf8');
  const denied = await runGateway({
    request: req(), host: hostFor(), tracking: tracking(root),
  });
  assert.equal(denied.status, 'denied');
  assert.equal(await readFile(join(root, '.pro-papa/tasks.json'), 'utf8'), before);
  const forbidden = resolve(fileURLToPath(new URL('..', import.meta.url)));
  await assert.rejects(runGateway({
    request: req(), host: hostFor('general', async () => ok(), { allowTaskWrites: true }),
    tracking: tracking(forbidden),
  }), /cannot modify the Pro-Papa framework roadmap/);
});

test('durable lifecycle stores no objective text and duplicates cannot double-execute', async t => {
  const root = await project(t);
  let calls = 0;
  const host = hostFor('general', async () => { calls++; return ok(); },
    { allowTaskWrites: true });
  const request = req('general', 'Confidential request with account password: should not persist');
  const once = await runGateway({ request, host, tracking: tracking(root) });
  assert.equal(once.status, 'completed');
  assert.equal(once.tracking.mode, 'durable');
  assert.equal(once.tracking.taskStatus, 'in_progress'); // Separate evidence/review still needed.
  assert.equal(once.tracking.runState, 'completed');
  const savedText = await readFile(join(root, '.pro-papa/tasks.json'), 'utf8');
  assert.equal(savedText.includes('Confidential request'), false);
  assert.equal(savedText.includes(SECRET), false);
  const saved = JSON.parse(savedText);
  assert.equal(saved.tasks.length, 1);
  assert.equal(saved.tasks[0].gatewayRequest.id, ID);
  assert.equal(saved.tasks[0].gatewayRequest.mac.length, 64);
  const dup = await runGateway({ request, host, tracking: tracking(root) });
  assert.equal(dup.status, 'already_executed');
  assert.equal(calls, 1);
  const changed = await runGateway({ request: { ...request, objective: 'Different request' },
    host, tracking: tracking(root) });
  assert.equal(changed.status, 'denied');
  assert.equal(changed.reason, 'idempotency_key_conflict');
  assert.equal(calls, 1);
});

test('durable work queues behind another project task and resumes without affecting roadmap', async t => {
  const root = await project(t);
  const { state, profiles } = await loadProject(root);
  const active = addTask(state, profiles, { title: 'Existing work',
    objective: 'Other task', profile: 'general', acceptance: ['Validated'] });
  startTask(state, active.id, 'other-agent');
  await saveState(root, state, profiles);
  let calls = 0;
  const request = req();
  const host = hostFor('general', async () => { calls++; return ok(); }, { allowTaskWrites: true });
  const wait = await runGateway({ request, host, tracking: tracking(root) });
  assert.equal(wait.status, 'queued_behind_active_task');
  assert.equal(calls, 0);
  const loaded = await loadProject(root);
  blockTask(loaded.state, active.id, 'External blocker');
  await saveState(root, loaded.state, loaded.profiles);
  const resumed = await runGateway({ request, host, tracking: tracking(root) });
  assert.equal(resumed.status, 'completed');
  assert.equal(calls, 1);
  const after = await loadProject(root);
  assert.equal(after.state.tasks[0].status, 'blocked');
  assert.equal(after.state.tasks[1].status, 'in_progress');
});

test('provider outage permits read-only host-approved retry but not unsafe implicit repeat', async t => {
  const root = await project(t);
  let calls = 0;
  const host = hostFor('general', async () => {
    calls++; if (calls === 1) throw Error('unavailable');
    return ok();
  }, { allowTaskWrites: true });
  const request = req();
  const first = await runGateway({ request, host, tracking: tracking(root) });
  assert.equal(first.status, 'provider_unavailable');
  assert.equal(first.tracking.runState, 'retryable');
  const noRetry = await runGateway({ request, host, tracking: tracking(root) });
  assert.equal(noRetry.status, 'retry_requires_host_authorization');
  assert.equal(calls, 1);
  const retry = await runGateway({ request, host, tracking: tracking(root, { retryApproved: true }) });
  assert.equal(retry.status, 'completed');
  assert.equal(calls, 2);
});

test('ambiguous provider response prevents retry and does not fabricate success', async t => {
  const root = await project(t);
  let calls = 0;
  const host = hostFor('general', async () => { calls++; return { ok: true, output: 'maybe' }; },
    { allowTaskWrites: true });
  const first = await runGateway({ request: req(), host, tracking: tracking(root) });
  assert.equal(first.status, 'unverified_execution');
  assert.equal(first.tracking.runState, 'ambiguous');
  const retried = await runGateway({ request: req(), host, tracking: tracking(root, { retryApproved: true }) });
  assert.equal(retried.status, 'needs_reconciliation');
  assert.equal(calls, 1);
});

test('durable tracking rejects missing secret, bad identity and cross-payload idempotency', async t => {
  const root = await project(t);
  const host = hostFor('general', async () => ok(), { allowTaskWrites: true });
  await assert.rejects(runGateway({
    request: { ...req(), id: 'not-a-uuid' }, host, tracking: tracking(root),
  }), /UUID/);
  await assert.rejects(runGateway({
    request: req(), host, tracking: tracking(root, { secret: 'short' }),
  }), /secret/);
});

test('concurrent identical tracked requests cannot both commit an execution reservation', async t => {
  const root = await project(t);
  let calls = 0;
  const host = hostFor('general', async () => { calls++; return ok(); }, { allowTaskWrites: true });
  const results = await Promise.allSettled([
    runGateway({ request: req(), host, tracking: tracking(root) }),
    runGateway({ request: req(), host, tracking: tracking(root) }),
  ]);
  assert.equal(calls <= 1, true);
  assert.equal(results.some(x => x.status === 'fulfilled' && x.value.status === 'completed'), true);
  assert.equal((await loadProject(root)).state.tasks.length, 1);
});
