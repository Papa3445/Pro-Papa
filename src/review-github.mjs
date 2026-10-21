// PP-0002: read-only GitHub review observer. No task-defined hosts or commands.
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const DECISIVE = new Set(['APPROVED', 'CHANGES_REQUESTED']);

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
  // Observe each reviewer's effective decision across the full PR history.
  // A request for changes on an older head is still blocking until this same
  // reviewer approves the current head or that *specific review ID* has its
  // state changed by GitHub to DISMISSED. A different dismissed record does
  // not clear this reviewer's still-active change request.
  // The REST API returns one current-state record per review ID. Detect
  // duplicate IDs instead of interpreting conflicting snapshots as events.
  const seenReviewIds = new Set();
  for (const review of reviews) {
    if (!Number.isSafeInteger(review?.id) || review.id <= 0 || seenReviewIds.has(review.id)) {
      throw new Error('GitHub review IDs missing or duplicated; refuse partial assessment');
    }
    seenReviewIds.add(review.id);
  }
  // Dismissal updates the *same review ID* in GitHub. Ignore the dismissed
  // record without erasing other decisions from the same account.
  // A decisive GitHub decision with incomplete identity cannot be safely
  // assigned to a reviewer or cleared by a later review. Never silently omit
  // an unknown CHANGES_REQUESTED; malformed approvals also fail closed.
  for (const review of reviews) {
    if (!DECISIVE.has(review.state)) continue;
    if (!Number.isSafeInteger(review.user?.id) || review.user.id <= 0 ||
        typeof review.user?.login !== 'string' || !review.user.login.trim() ||
        typeof review.submitted_at !== 'string' || !Number.isFinite(Date.parse(review.submitted_at)) ||
        typeof review.commit_id !== 'string' || !/^[a-f0-9]{40}$/.test(review.commit_id)) {
      throw new Error('Malformed decisive GitHub review record; refuse incomplete review identity');
    }
  }
  const candidates = reviews.filter(review =>
    DECISIVE.has(review.state) && isReviewer(review, pull.user) &&
    typeof review.submitted_at === 'string' && Number.isFinite(Date.parse(review.submitted_at)) &&
    Number.isSafeInteger(review.id) && review.id > 0);
  candidates.sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id);
  const latestByReviewer = new Map();
  for (const review of candidates) {
    const previous = latestByReviewer.get(review.user.id);
    // A stale approval must not clear a pending changes-requested decision.
    if (previous?.state === 'CHANGES_REQUESTED' &&
        review.state === 'APPROVED' && review.commit_id !== candidateSha) continue;
    latestByReviewer.set(review.user.id, review);
  }
  const latest = [...latestByReviewer.values()];
  const outstanding = latest.filter(review => review.state === 'CHANGES_REQUESTED');
  const approvals = latest.filter(review => review.state === 'APPROVED' && review.commit_id === candidateSha);
  const reviewed = { provider: 'github', repository: target.repository, pullRequest: target.pullRequest, candidateSha };
  if (outstanding.length) return { ...reviewed, verdict: 'FAIL',
    reason: 'Outstanding changes-requested review (including older PR heads)',
    blockingReviewIds: outstanding.map(x => x.id) };
  if (!approvals.length) return { ...reviewed, verdict: 'FAIL', reason: 'No independent GitHub approval on current PR head' };
  // Maps preserve the first insertion position when an account re-reviews.
  // Use submission order, not Map order, to select the newest valid approval.
  approvals.sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id);
  const latestApproval = approvals.at(-1);
  const approvedReviewers = approvals.map(review => ({
    login: review.user.login, id: review.user.id,
    reviewId: review.id, submittedAt: review.submitted_at,
  }));
  return { ...reviewed, verdict: 'PASS', reason: 'Latest independent GitHub review approved exact current head',
    reviewer: { login: latestApproval.user.login, id: latestApproval.user.id },
    reviewId: latestApproval.id, submittedAt: latestApproval.submitted_at, approvedReviewers };
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
  // A stable PR head alone does not pin a changing review history.
  // Bracket TWO complete review snapshots with PR identity checks.
  async function readReviews() {
    const reviews = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await getJson(`${root}/reviews?per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length > 100) throw new Error('Malformed GitHub review collection');
      reviews.push(...batch);
      if (batch.length < 100) return reviews;
    }
    throw new Error('Too many reviews to verify completely: refuse partial assessment');
  }
  function samePull(a, b) {
    return a?.head?.sha === b?.head?.sha &&
      a?.number === b?.number &&
      a?.base?.repo?.full_name === b?.base?.repo?.full_name &&
      a?.user?.id === b?.user?.id &&
      a?.user?.login === b?.user?.login;
  }
  function snapshot(reviews) {
    // Compare all review identities and decision fields independently of API order.
    // New reviews, dismissals, and state changes all invalidate the first read.
    return JSON.stringify(reviews.map(review => ({
      id: review?.id, state: review?.state, commit: review?.commit_id,
      submitted: review?.submitted_at, userId: review?.user?.id, login: review?.user?.login,
    })).sort((a, b) => a.id - b.id));
  }
  const firstPull = await getJson(root);
  const firstReviews = await readReviews();
  const middlePull = await getJson(root);
  if (!samePull(firstPull, middlePull)) {
    throw new Error('GitHub PR head or identity changed during review lookup; retry');
  }
  const secondReviews = await readReviews();
  const finalPull = await getJson(root);
  if (!samePull(middlePull, finalPull)) {
    throw new Error('GitHub PR head or identity changed during review lookup; retry');
  }
  if (snapshot(firstReviews) !== snapshot(secondReviews)) {
    throw new Error('GitHub reviews changed during review lookup; retry');
  }
  // No GitHub REST sequence is atomic with future pushes or reviews.
  // Protect any subsequent merge using the expected head SHA.
  return evaluateGitHubReviews(target, finalPull, secondReviews);
}
