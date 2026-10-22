import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../.pro-papa/evidence/PP-0007/', import.meta.url);
const sha = x => createHash('sha256').update(x).digest('hex');
const read = path => readFileSync(new URL(path, root), 'utf8');
test('PP-0007 canonical mock and native reports disclose true transport distinction', () => {
  const mock=JSON.parse(read('deterministic-fixtures.json'));
  const live=JSON.parse(read('live-read-only-github.json'));
  const manifest=JSON.parse(read('provider-observation-current.json'));
  assert.equal(mock.mode,'deterministic_fake_github');
  assert.equal(live.mode,'live_read_only_github');
  for(const [report,n] of [[mock,0],[live,1]]) {
    assert.equal(report.totalGitHubCallsObserved,n);
    assert.equal(report.totalResearchTransportCallsObserved,1);
    assert.equal(report.pilots.find(p=>p.id==='research').providerCalls,n);
    assert.equal(report.pilots.find(p=>p.id==='research').transportCalls,1);
    assert.equal(report.successfulUserTasks,2);
    assert.equal(report.safelyUnsupported,5);
    assert.equal(report.guardrailsPassed,true);
    assert.equal(report.negatives.filter(x=>x.passed).length,4);
  }
  assert.equal(sha(read('deterministic-fixtures.json')),manifest.fixture.sha256);
  assert.equal(sha(read('live-read-only-github.json')),manifest.live.sha256);
  assert.equal(sha(read('historical/deterministic-fixtures.json')),manifest.historical.fixtureSha256);
  assert.equal(sha(read('historical/live-read-only-github.json')),manifest.historical.liveSha256);
  assert.equal(sha(read('historical/github-actions-142-tests.json')),manifest.historical.jobSha256);
  const old=JSON.parse(read('historical/deterministic-fixtures.json'));
  assert.equal(old.totalGitHubCallsObserved,1,'archived historical stub counter remains untouched');
  assert.equal(old.mode,'deterministic_fake_github');
  assert.equal(manifest.sourceBranchHeadAtRun,'943d2addc2d886e93379cd4bc0c5512ae6a7d8f9');
  assert.equal(manifest.benchmarkScriptGitBlobSha,'347f36e4a28454168ea8e66f6c9973a70b556ce2');
  assert.equal(manifest.workflowRunId,39711547417);
});
