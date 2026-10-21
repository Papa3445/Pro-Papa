#!/usr/bin/env node
import { resolve } from 'node:path';
import { runDomainCheck } from '../src/adapters.mjs';
import { issueUsageReceipt } from '../src/usage-receipts.mjs';
import { verifyGitHubReview, validateReviewTarget } from '../src/review-github.mjs';
import {
  loadProject, selectNext, findTask, addTask, startTask,
  blockTask, unblockTask, recordEvidence, closeTask,
  saveState, taskHandoff, initializeProject,
} from '../src/core.mjs';

function argumentsFor(argv) {
  const [command = 'help', ...args] = argv;
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith('--')) throw new Error(`unexpected argument ${key}`);
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`${key} requires a value`);
    const name = key.slice(2);
    flags[name] = name === 'accept' ? [...(flags[name] ?? []), value] : value;
  }
  return { command, flags };
}

function required(flags, key) {
  if (typeof flags[key] !== 'string' || !flags[key].trim()) throw new Error(`--${key} is required`);
  return flags[key];
}

export async function main(argv = process.argv.slice(2), output = console.log) {
  const { command, flags } = argumentsFor(argv);
  if (command === 'help') {
    output('Pro-Papa v0.1\nCommands: init, validate, status, next, add, start, block, unblock, handoff, proof, adapter-check, review-status, review-gate, usage-receipt, close\nCommon: --root PATH\ninit --name NAME [--root PATH] [--guide true]\nadd --title TITLE --objective OBJECTIVE --profile PROFILE --accept CRITERION [--accept CRITERION] [--depends ID,ID]\nstart --id ID --actor NAME\nblock --id ID --reason TEXT | unblock --id ID\nhandoff --id ID\nproof --id ID --kind KIND --file RELPATH --actor NAME --note TEXT [--result pass|fail]\nadapter-check --id ID --file RELPATH --actor NAME\nreview-status --id ID (uses GITHUB_TOKEN)\nreview-gate --repo OWNER/REPO --pr NUMBER\nusage-receipt [--source OWNER/REPO] [--store PRIVATE_OWNER/REPO] [--ref BRANCH]\nclose --id ID');
    return;
  }
  if (command === 'review-gate') {
    const target = validateReviewTarget({ repository: required(flags, 'repo'), pullRequest: Number(required(flags, 'pr')) });
    const verdict = await verifyGitHubReview(target);
    output(JSON.stringify(verdict, null, 2));
    if (verdict.verdict !== 'PASS') process.exitCode = 1;
    return;
  }
  if (command === 'usage-receipt') {
    const receipt = await issueUsageReceipt({
      sourceRepository: flags.source ?? process.env.PRO_PAPA_SOURCE_REPO ?? 'Papa3445/Pro-Papa',
      storeRepository: flags.store ?? process.env.PRO_PAPA_AUDIT_REPO,
      sourceRef: flags.ref ?? 'main',
    });
    output(JSON.stringify(receipt, null, 2));
    return;
  }
  const root = resolve(flags.root ?? process.cwd());
  if (command === 'init') {
    const state = await initializeProject(root, required(flags, 'name'), { agentGuide: flags.guide === 'true' });
    output(JSON.stringify({ created: true, project: state.project, root }));
    return;
  }
  const { state, profiles } = await loadProject(root);
  if (command === 'validate') { output(JSON.stringify({ valid: true, project: state.project, tasks: state.tasks.length })); return; }
  if (command === 'status') {
    output(JSON.stringify({ project: state.project, tasks: state.tasks.map(({ id, title, profile, status, blockedReason }) => ({ id, title, profile, status, blockedReason })) }, null, 2)); return;
  }
  if (command === 'next') { output(JSON.stringify(selectNext(state), null, 2)); return; }
  if (command === 'handoff') { output(taskHandoff(findTask(state, required(flags, 'id')), profiles)); return; }
  if (command === 'review-status') {
    const task = findTask(state, required(flags, 'id'));
    if (!task.requiresTrustedReview) throw new Error('task does not require a trusted GitHub review');
    const verdict = await verifyGitHubReview(task.reviewTarget);
    output(JSON.stringify(verdict, null, 2));
    if (verdict.verdict !== 'PASS') process.exitCode = 1;
    return;
  }
  let result;
  if (command === 'add') result = addTask(state, profiles, {
    title: required(flags, 'title'), objective: required(flags, 'objective'),
    profile: required(flags, 'profile'), acceptance: flags.accept ?? [],
    dependsOn: flags.depends ? flags.depends.split(',').map(part => part.trim()) : [],
  });
  else if (command === 'start') result = startTask(state, required(flags, 'id'), required(flags, 'actor'));
  else if (command === 'block') result = blockTask(state, required(flags, 'id'), required(flags, 'reason'));
  else if (command === 'unblock') result = unblockTask(state, required(flags, 'id'));
  else if (command === 'proof') result = await recordEvidence(root, state, {
    id: required(flags, 'id'), kind: required(flags, 'kind'), file: required(flags, 'file'),
    actor: required(flags, 'actor'), note: required(flags, 'note'), result: flags.result ?? 'pass',
  });
  else if (command === 'adapter-check') result = await runDomainCheck({ root, state, id: required(flags, 'id'), file: required(flags, 'file'), actor: required(flags, 'actor') });
  else if (command === 'close') result = await closeTask(root, state, profiles, required(flags, 'id'));
  else throw new Error(`unknown command ${command}`);
  await saveState(root, state, profiles);
  output(JSON.stringify(result, null, 2));
  if (command === 'adapter-check' && result.report.result !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch(error => { console.error(`Pro-Papa: ${error.message}`); process.exitCode = 1; });
}
