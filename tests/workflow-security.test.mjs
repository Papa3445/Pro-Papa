import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

// Guard against reintroducing a PR-controlled status-writing review workflow.
test('CI contains no privileged review or custom status-writing workflow', async () => {
  const workflows = (await readdir('.github/workflows')).filter(name => /\.ya?ml$/.test(name));
  assert.ok(workflows.includes('verify.yml'), 'normal verification workflow must exist');
  for (const name of workflows) {
    const source = await readFile('.github/workflows/' + name, 'utf8');
    assert.doesNotMatch(source, /statuses:\s*write|checks:\s*write|pull_request_review\s*:/);
    assert.doesNotMatch(source, /review-integrity|base-pin/);
  }
});
