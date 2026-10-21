#!/usr/bin/env node
// Reference CLI: supports two explicitly authorized, read-only built-ins.
// Other domains require a separately configured, trusted host capability.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGateway } from '../src/gateway.mjs';

export const BUILTIN_HANDLERS = Object.freeze({
  'text.metrics': async ({ objective }) => ({
    ok: true, output: {
      characters: [...objective].length,
      words: objective.trim().split(/\s+/u).filter(Boolean).length,
    }, provenance: { provider: 'builtin', operation: 'text.metrics' },
  }),
  'math.sum': async ({ inputs }) => {
    const nums = inputs?.numbers;
    if (!Array.isArray(nums) || nums.length === 0 || nums.length > 1000 ||
      nums.some(x => typeof x !== 'number' || !Number.isFinite(x))) {
      return { ok: false };
    }
    const total = nums.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(total)) return { ok: false };
    return { ok: true, output: { sum: total },
      provenance: { provider: 'builtin', operation: 'math.sum' } };
  },
});

const allowed = new Set(['--project', '--durable', '--audit']);
export function parseCli(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i]) || Object.hasOwn(out, args[i])) throw new Error('Unknown or repeated gateway flag');
    if (args[i] === '--project') {
      const v = args[++i];
      if (!v || v.startsWith('--')) throw new Error('Missing project root');
      out.project = v;
    } else out[args[i]] = true;
  }
  if (out['--durable'] && !out.project) throw new Error('Durable requests require --project');
  return out;
}
async function readInput() {
  let text = '';
  process.stdin.setEncoding('utf8');
  for await (const piece of process.stdin) {
    text += piece;
    if (Buffer.byteLength(text, 'utf8') > 64 * 1024) throw new Error('Input too large');
  }
  return JSON.parse(text);
}
export async function main(args = process.argv.slice(2), input = readInput, output = console.log) {
  const flags = parseCli(args);
  const request = await input();
  const audit = flags['--audit'] === true;
  const response = await runGateway({
    request,
    host: {
      handlers: BUILTIN_HANDLERS, grants: ['text.metrics', 'math.sum'],
      allowTaskWrites: flags['--durable'] === true,
      audit,
      pp0004Options: audit ? {
        sourceRepository: process.env.PRO_PAPA_SOURCE_REPO ?? 'Papa3445/Pro-Papa',
        storeRepository: process.env.PRO_PAPA_AUDIT_REPO,
      } : undefined,
    },
    tracking: flags['--durable'] ? {
      mode: 'durable', projectRoot: flags.project,
      secret: process.env.PRO_PAPA_GATEWAY_SECRET,
    } : { mode: 'ephemeral' },
  });
  output(JSON.stringify(response));
  if (['denied', 'provider_unavailable', 'unverified_execution', 'unsupported'].includes(response.status)) process.exitCode = 1;
  return response;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch(() => {
    // Do not leak handler, token, prompt or filesystem secrets through exceptions.
    console.log(JSON.stringify({ status: 'invalid_request' }));
    process.exitCode = 1;
  });
}
