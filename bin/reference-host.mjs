#!/usr/bin/env node
// Explicit PP-0006 host entrypoint. JSON arrives only on stdin.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createReferenceHost } from '../src/reference-host.mjs';

function parse(args) {
  const allowed = new Set(['--github-read', '--github-repo', '--audit-required',
    '--durable', '--project', '--approve-create-issue-id', '--issue-repository']);
  const boolean = new Set(['--github-read', '--audit-required', '--durable']);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!allowed.has(key) || Object.hasOwn(result, key)) throw Error('Unknown or repeated host option');
    if (boolean.has(key)) result[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw Error('Missing host option value');
      result[key] = value;
    }
  }
  if (result['--project'] && !result['--durable']) throw Error('Project requires durable mode');
  if (result['--durable'] && !result['--project']) throw Error('Missing project');
  if (Boolean(result['--approve-create-issue-id']) !==
      Boolean(result['--issue-repository'])) throw Error('Effect needs exact ID and repository');
  if (result['--approve-create-issue-id'] && !result['--durable'])
    throw Error('External effects require durable tracking');
  return result;
}
async function readInput(stream) {
  let input = '';
  for await (const piece of stream) {
    input += piece;
    if (Buffer.byteLength(input, 'utf8') > 65536) throw Error('Request too large');
  }
  return JSON.parse(input);
}
export async function main(argv = process.argv.slice(2),
  stdin = process.stdin, output = console.log) {
  const flags = parse(argv);
  if (flags['--audit-required'] && !process.env.PRO_PAPA_AUDIT_REPO) {
    const rejected = { status: 'audit_failed', audit: { status: 'failed' }, execution: null };
    output(JSON.stringify(rejected));
    process.exitCode = 1;
    return rejected;
  }
  const repos = flags['--github-repo'] ? [flags['--github-repo']] : [];
  if (flags['--issue-repository'] &&
      !repos.some(x => x.toLowerCase() === flags['--issue-repository'].toLowerCase()))
    throw Error('Issue repository is not host-allowlisted');
  const reference = createReferenceHost({
    allowedRepositories: repos,
    githubResearch: flags['--github-read'] === true,
    approvedIssue: flags['--approve-create-issue-id'] ? {
      requestId: flags['--approve-create-issue-id'],
      repository: flags['--issue-repository'],
    } : null,
    auditMode: flags['--audit-required'] ? 'required' : 'off',
    auditRepository: process.env.PRO_PAPA_AUDIT_REPO,
    durableProject: flags['--durable'] ? flags['--project'] : null,
  });
  const response = await reference.execute(await readInput(stdin));
  output(JSON.stringify(response));
  if (!['completed', 'already_executed'].includes(response.status))
    process.exitCode = 1;
  return response;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch(() => {
    // No errors, prompt contents, URLs, secrets or stack traces on stdout/stderr.
    console.log(JSON.stringify({ status: 'invalid_request' }));
    process.exitCode = 1;
  });
}
