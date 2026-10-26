import test from 'node:test';
import assert from 'node:assert/strict';

// INTENTIONAL FAILURE: disposable F-01 branch-protection challenge, never merge.
test('F-01 governance negative control: deliberately fail required CI', () => {
  assert.fail('INTENTIONAL F-01 MERGE-GATE PROBE FAILURE — not a production defect');
});
