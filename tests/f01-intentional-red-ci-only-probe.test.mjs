import test from 'node:test';
import assert from 'node:assert/strict';

// DISPOSABLE F-01 GOVERNANCE NEGATIVE CONTROL. Never merge this test branch.
test('F-01 CI failure-only gate: intentionally fail after independent approval', () => {
  assert.fail('INTENTIONAL FAILING REQUIRED CHECK — F-01 NEGATIVE CONTROL, NOT PRODUCT DEFECT');
});
