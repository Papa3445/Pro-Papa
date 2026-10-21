// PP-0002: read-only GitHub review observer. No task-defined hosts or commands.
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const DECISIVE = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

export function validateReviewTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target) ||
      typeof target.repository !== 'string' || !REPO_PATTERN.test(target.repository) ||
      !Number.isSafeInteger(target.pullRequest) || target.pullRequest < 1 ||
      Object.keys(target).some(key => !['repository', 'pullRequest'].includes(key))) {
    throw new Error('trusted review requires an exact GitHub repository and pull request number');
  }
  return target;
}

function isReviewer(review, author) {
  return review && Number.isSafeInteger(review.user?.id) && review.user.id > 0 &&
    typeof review.user?.login === 'string' && review.user.login.length > 0 &&
    review.user.id !== author?.id && review.user.login.toLowerCase() !== author?.login?.toLowerCase();
}

// Policy evaluation is testable; only provider-fetched data may be used to grant closure.
export function evaluateGitHubReviews(target, pull, reviews) {
  validateReviewTarget(target);
  if (!pull || typeof pull !== 'object' || !Array.isArray(reviews) ||
      pull.number !== target.pullRequest ||
      pull.base?.repo?.full_name?.toLowerCase() !== target.repository.toLowerCase() ||
      !/^[a-f0-9]{40}$/.test(pull.head?.sha ?? '') ||
      !Number.isSafeInteger(pull.user?.id) || !pull.user?.login) {
    throw new Error('GitHub pull request identity cannot be established');
  }
  const candidateSha = pull.head.sha;
  const candidates = reviews.filter(review => review.commit_id === candidateSha &&
    DECISIVE.has(review.state) && isReviewer(review, pull.user) &&
    typeof review.submitted_at === 'string' && Number.isFinite(Date.parse(review.submitted_at)) &&
    Number.isSafeInteger(review.id));
  candidates.sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id);
  const latestByReviewer = new Map();
  for (const review of candidates) latestByReviewer.set(review.user.id, review);
  const outstanding = [...latestByReviewer.values()].filter(review => review.state === 'CHANGES_REQUESTED');
  const approvals = [...latestByReviewer.values()].filter(review => review.state === 'APPROVED');
  const reviewed = { provider: 'github', repository: target.repository, pullRequest: target.pullRequest, candidateSha };
  if (outstanding.length) return { ...reviewed, verdict: 'FAIL', reason: 'Outstanding changes-requested review on current head', blockingReviewIds: outstanding.map(x => x.id) };
  if (!approvals.length) return { ...reviewed, verdict: 'FAIL', reason: 'No independent GitHub approval on current PR head' };
  const latestApproval = approvals.at(-1);
  return { ...reviewed, verdict: 'PASS', reason: 'Latest independent GitHub review approved exact current head',
    reviewer: { login: latestApproval.user.login, id: latestApproval.user.id },
    reviewId: latestApproval.id, submittedAt: latestApproval.submitted_at };
}

export async function verifyGitHubReview(target, { token = process.env.GITHUB_TOKEN, fetchImpl = globalThis.fetch } = {}) {
  validateReviewTarget(target);
  if (typeof token !== 'string' || !token.trim()) throw new Error('GITHUB_TOKEN required to authenticate GitHub review lookup');
  if (typeof fetchImpl !== 'function') throw new Error('HTTPS fetch is not available');
  const headers = {
    Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Pro-Papa-review-gate',
  };
  const root = `https://api.github.com/repos/${target.repository}/pulls/${target.pullRequest}`;
  async function getJson(url) {
    const response = await fetchImpl(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response || !response.ok) throw new Error(`GitHub review lookup failed: HTTP ${response?.status ?? 'unknown'}`);
    return response.json();
  }
  const pull = await getJson(root);
  const reviews = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await getJson(`${root}/reviews?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length > 100) throw new Error('Malformed GitHub review collection');
    reviews.push(...batch);
    if (batch.length < 100) return evaluateGitHubReviews(target, pull, reviews);
  }
  throw new Error('Too many reviews to verify completely: refuse partial assessment');
}
