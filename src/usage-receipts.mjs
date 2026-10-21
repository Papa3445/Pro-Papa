// PP-0004: real GitHub read + private GitHub write + readback.
// Proves provider-visible operations, NOT reasoning, model identity, or conversation contents.
import { randomUUID } from 'node:crypto';

const REPO = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const FILES = Object.freeze(['AGENTS.md', '.pro-papa/profiles.json']);
const API = 'https://api.github.com';
function insist(ok, message) { if (!ok) throw new Error(message); }

export function validateUsageOptions({ sourceRepository, storeRepository, sourceRef = 'main' }) {
  insist(typeof sourceRepository === 'string' && REPO.test(sourceRepository), 'Invalid source GitHub repository');
  insist(typeof storeRepository === 'string' && REPO.test(storeRepository), 'Invalid GitHub audit repository');
  insist(sourceRepository.toLowerCase() !== storeRepository.toLowerCase(),
    'Audit store must be separate from framework source');
  insist(typeof sourceRef === 'string' && REF.test(sourceRef) &&
    !sourceRef.split('/').some(part => !part || part === '.' || part === '..'),
    'Invalid source ref');
  return { sourceRepository, storeRepository, sourceRef };
}

function decodeGitHubContent(file) {
  insist(file?.type === 'file' && file.encoding === 'base64' &&
    typeof file.content === 'string' && typeof file.sha === 'string' &&
    COMMIT.test(file.sha) && Number.isSafeInteger(file.size) &&
    file.size > 0 && file.size <= 256 * 1024,
    'Invalid or oversized GitHub framework file response');
  const cleaned = file.content.replace(/\s/g, '');
  insist(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(cleaned),
    'Invalid GitHub file encoding');
  const buffer = Buffer.from(cleaned, 'base64');
  insist(buffer.length === file.size, 'GitHub file byte count mismatch');
  // SHA-1 Git blob check: GitHub's contents sha must bind the bytes returned.
  // Node's crypto is only used on fixed provider data, never executed.
  return buffer;
}

export async function issueUsageReceipt({
  sourceRepository, storeRepository, sourceRef = 'main',
  token = process.env.GITHUB_TOKEN, fetchImpl = globalThis.fetch,
  uuid = randomUUID, now = () => new Date().toISOString(),
} = {}) {
  validateUsageOptions({ sourceRepository, storeRepository, sourceRef });
  insist(typeof token === 'string' && token.trim(), 'GITHUB_TOKEN required');
  insist(typeof fetchImpl === 'function', 'GitHub HTTP client unavailable');
  insist(typeof uuid === 'function' && typeof now === 'function', 'Invalid receipt clock or ID generator');
  const request = async (path, method = 'GET', payload) => {
    const response = await fetchImpl(API + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Pro-Papa-usage-receipt',
        ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    insist(response?.ok, 'GitHub API ' + method + ' request failed: HTTP ' + (response?.status ?? 'unknown'));
    return response.json();
  };
  // Reject a public/misconfigured destination before any receipt can be published.
  const store = await request('/repos/' + storeRepository);
  insist(store?.full_name?.toLowerCase() === storeRepository.toLowerCase() &&
    store.private === true && typeof store.default_branch === 'string' &&
    REF.test(store.default_branch) && !store.default_branch.split('/').some(x => x === '.' || x === '..'),
    'Audit repository must exist, match the target, and be private');
  const source = await request('/repos/' + sourceRepository + '/commits/' + encodeURIComponent(sourceRef));
  insist(COMMIT.test(source?.sha), 'Unable to pin source commit identity');
  const consulted = [];
  for (const path of FILES) {
    const response = await request('/repos/' + sourceRepository + '/contents/' + path +
      '?ref=' + source.sha);
    const bytes = decodeGitHubContent(response);
    // Verify returned Git blob SHA against the actual bytes, not a claimed filename.
    const { createHash } = await import('node:crypto');
    const computed = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    insist(computed === response.sha && response.path === path,
      'Framework source hash/path mismatch');
    if (path === 'AGENTS.md') {
      insist(bytes.toString('utf8').includes('Pro-Papa') &&
        bytes.toString('utf8').includes('AI Operating Contract'),
        'Unexpected framework operating contract');
    } else {
      const registry = JSON.parse(bytes.toString('utf8'));
      insist(registry.schemaVersion === 1 && registry.profiles?.general,
        'Unexpected domain profile schema');
    }
    consulted.push({ path, gitBlobSha: response.sha });
  }
  const id = uuid();
  insist(typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    'Invalid receipt UUID');
  const timestamp = now();
  insist(typeof timestamp === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(timestamp) &&
    Number.isFinite(Date.parse(timestamp)), 'Invalid receipt timestamp');
  const month = timestamp.slice(0, 7).replace('-', '/');
  const path = 'usage-receipts/' + month + '/' + id + '.json';
  const receipt = {
    schemaVersion: 1, receiptId: id, recordedAt: timestamp,
    operation: 'read-framework-instructions',
    sourceRepository, sourceCommit: source.sha, consulted,
    verificationScope: 'GitHub files read and provider-backed private receipt write/readback; not proof of reasoning',
  };
  const raw = JSON.stringify(receipt, null, 2) + '\n';
  const created = await request('/repos/' + storeRepository + '/contents/' + path,
    'PUT', { message: 'audit: record Pro-Papa framework read ' + id,
      content: Buffer.from(raw, 'utf8').toString('base64'), branch: store.default_branch });
  insist(COMMIT.test(created?.commit?.sha) && COMMIT.test(created?.content?.sha) &&
    created.content.path === path, 'GitHub did not confirm receipt commit');
  // Validate readback from the exact new commit. Never assert saved without it.
  const stored = await request('/repos/' + storeRepository + '/contents/' + path +
    '?ref=' + created.commit.sha);
  const readback = decodeGitHubContent(stored);
  insist(stored.path === path && stored.sha === created.content.sha &&
    readback.toString('utf8') === raw, 'Receipt readback did not match saved data');
  const url = 'https://github.com/' + storeRepository + '/blob/' + created.commit.sha + '/' + path;
  return {
    status: 'confirmed', sourceRepository, sourceCommit: source.sha,
    consulted, receiptId: id, receiptUrl: url, receiptCommit: created.commit.sha,
    storeRepository, visibility: 'private',
    caveat: 'Proves provider-visible reads and committed receipt, not internal AI reasoning',
  };
}
