#!/usr/bin/env node
// Trusted workflow entry point. No code or shell arguments from the PR are executed.
import { publishOneReviewStatus, publishForBaseBranch } from '../src/review-status.mjs';

const repo = process.env.PR_REPO;
const number = process.env.PR_NUMBER;
const event = process.env.GITHUB_EVENT_NAME;
const action = process.env.GITHUB_EVENT_ACTION;
async function main() {
  if (!repo) throw new Error('PR_REPO required');
  if (event === 'push') {
    const branch = process.env.BASE_BRANCH;
    if (!branch) throw new Error('BASE_BRANCH required for push');
    const results = await publishForBaseBranch(repo, branch);
    console.log(JSON.stringify({ scanned: results.length, results }, null, 2));
    // Failure states are published on each actual PR head. A base-branch
    // push itself is not a failed build because its PRs await review.
    return;
  }
  if (!/^[0-9]+$/.test(number ?? '') || Number(number) < 1) {
    throw new Error('PR_NUMBER required for pull request or review events');
  }
  const allowInitialPin = event === 'pull_request_target' &&
    (action === 'opened' || action === 'synchronize');
  const result = await publishOneReviewStatus(repo, Number(number), {
    allowInitialPin, allowedBaseRef: process.env.TRUSTED_BASE_BRANCH || 'main',
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.verdict !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error('Pro-Papa review status: ' + error.message); process.exitCode = 1; });
