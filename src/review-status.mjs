// Immutable GitHub commit-status pin for a PR's reviewed comparison base.
// Runs only from trusted default-branch workflow code; never execute PR code.
import { validateReviewTarget, verifyGitHubReview } from './review-github.mjs';

export const PIN_CONTEXT = 'pro-papa/base-pin';
export const REVIEW_CONTEXT = 'pro-papa/review-integrity';
const BOT_ID = 41898282; // GitHub's github-actions[bot] account
const SHA = /^[a-f0-9]{40}$/;

function requireValid(ok, message) { if (!ok) throw new Error(message); }

export async function makeGitHubClient(repository, { token = process.env.GITHUB_TOKEN, fetchImpl = globalThis.fetch } = {}) {
  validateReviewTarget({ repository, pullRequest: 1 });
  requireValid(typeof token === 'string' && token.trim(), 'GITHUB_TOKEN required for GitHub review status');
  requireValid(typeof fetchImpl === 'function', 'GitHub fetch unavailable');
  const base = 'https://api.github.com/repos/' + repository;
  const headers = {
    Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Pro-Papa-review-status',
  };
  const request = async (path, method = 'GET', body) => {
    const response = await fetchImpl(base + path, {
      method, headers, redirect: 'error', signal: AbortSignal.timeout(15000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response?.ok) throw new Error('GitHub status API failed: HTTP ' + (response?.status ?? 'unknown'));
    return response.json();
  };
  return { request, token, fetchImpl };
}

function identity(pr, repository, number) {
  requireValid(pr?.number === number && pr.base?.repo?.full_name?.toLowerCase() === repository.toLowerCase() &&
    SHA.test(pr.head?.sha ?? '') && SHA.test(pr.base?.sha ?? '') &&
    typeof pr.base?.ref === 'string' && pr.base.ref.length > 0,
    'GitHub PR comparison identity missing');
  return { headSha: pr.head.sha, baseRef: pr.base.ref, baseSha: pr.base.sha };
}

function description(baseRef, baseSha) {
  const value = 'base-ref=' + encodeURIComponent(baseRef) + ';base-sha=' + baseSha;
  requireValid(value.length <= 140, 'Base branch name too long for trusted pin');
  return value;
}

function readPin(statuses) {
  requireValid(Array.isArray(statuses), 'Malformed GitHub commit status collection');
  const pins = statuses.filter(s => s?.context === PIN_CONTEXT)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  if (!pins.length) return null;
  // First pin on this exact head SHA is immutable history, not the latest rewrite.
  const first = pins[0];
  requireValid(first.creator?.id === BOT_ID && first.creator?.login === 'github-actions[bot]' &&
    Number.isSafeInteger(first.id) && first.id > 0 && first.state === 'pending' &&
    typeof first.created_at === 'string' && Number.isFinite(Date.parse(first.created_at)),
    'First base-pin status was not created by trusted GitHub Actions');
  const match = /^base-ref=([^;]+);base-sha=([a-f0-9]{40})$/.exec(first.description ?? '');
  requireValid(match, 'Malformed trusted base-pin status');
  const ref = decodeURIComponent(match[1]);
  validateReviewTarget({ repository: 'example/repo', pullRequest: 1, baseRef: ref, baseSha: match[2] });
  return { baseRef: ref, baseSha: match[2], createdAt: first.created_at, statusId: first.id };
}

async function statusHistory(client, headSha) {
  const list = [];
  for (let page = 1; page <= 10; page++) {
    const part = await client.request('/commits/' + headSha + '/statuses?per_page=100&page=' + page);
    requireValid(Array.isArray(part) && part.length <= 100, 'Malformed status page');
    list.push(...part);
    if (part.length < 100) return list;
  }
  throw new Error('Too many status records for trusted review pin');
}

async function postStatus(client, headSha, state, context, desc) {
  return client.request('/statuses/' + headSha, 'POST', {
    state, context, description: desc.slice(0, 140),
  });
}

export async function publishOneReviewStatus(repository, pullRequest, {
  allowInitialPin = false, token, fetchImpl,
} = {}) {
  validateReviewTarget({ repository, pullRequest });
  const client = await makeGitHubClient(repository, { token, fetchImpl });
  const initial = await client.request('/pulls/' + pullRequest);
  const first = identity(initial, repository, pullRequest);
  let final = { verdict: 'FAIL', reason: 'Unverified comparison', candidateSha: first.headSha };
  try {
    let pin = readPin(await statusHistory(client, first.headSha));
    if (!pin && allowInitialPin) {
      // Only opened/synchronize may initialize a new SHA. No re-pinning
      // after retarget, review or target-branch push on an existing SHA.
      const created = await postStatus(client, first.headSha, 'pending', PIN_CONTEXT,
        description(first.baseRef, first.baseSha));
      pin = readPin([created]);
    }
    requireValid(pin, 'No trusted baseline recorded for this PR head; reopen or push new head');
    const target = { repository, pullRequest, baseRef: pin.baseRef, baseSha: pin.baseSha };
    final = await verifyGitHubReview(target, { token: client.token, fetchImpl: client.fetchImpl });
    if (final.verdict === 'PASS') {
      requireValid(final.approvedReviewers.some(reviewer => Date.parse(reviewer.submittedAt) > Date.parse(pin.createdAt)),
        'Current-head approval predates trusted baseline pin');
    }
    const after = identity(await client.request('/pulls/' + pullRequest), repository, pullRequest);
    requireValid(after.headSha === first.headSha && after.baseRef === first.baseRef &&
      after.baseSha === first.baseSha, 'GitHub PR identity changed before publishing status');
  } catch (error) {
    final = { verdict: 'FAIL', reason: error.message, candidateSha: first.headSha };
  }
  await postStatus(client, first.headSha, final.verdict === 'PASS' ? 'success' : 'failure', REVIEW_CONTEXT,
    final.verdict + ': ' + final.reason);
  return { ...final, statusContext: REVIEW_CONTEXT };
}

export async function publishForBaseBranch(repository, baseRef, options = {}) {
  requireValid(typeof baseRef === 'string' && baseRef.length > 0 &&
    /^[A-Za-z0-9._/-]+$/.test(baseRef), 'Invalid target branch for status scan');
  const client = await makeGitHubClient(repository, options);
  const results = [];
  for (let page = 1; page <= 10; page++) {
    const prs = await client.request('/pulls?state=open&base=' + encodeURIComponent(baseRef) +
      '&per_page=100&page=' + page);
    requireValid(Array.isArray(prs) && prs.length <= 100, 'Malformed open PR page');
    for (const pr of prs) {
      requireValid(Number.isSafeInteger(pr?.number) && pr.number > 0, 'Malformed PR listing');
      results.push(await publishOneReviewStatus(repository, pr.number, {
        ...options, allowInitialPin: false,
      }));
    }
    if (prs.length < 100) return results;
  }
  throw new Error('Too many open PRs to recheck after base advance');
}
