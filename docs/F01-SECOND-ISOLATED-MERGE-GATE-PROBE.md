# F-01 isolated independent merge-eligibility challenge

This file exists **only** in an isolated test PR to exercise GitHub's native
review+CI rules. The branch **MUST NEVER be merged into `main`**.

## Stages (each stage requires real GitHub CI and review-state readback)

1. **Green and unreviewed:** the real required CI check passes, no reviews
   submitted, and GitHub mergeability should show blocked.
2. **Green and independently approved:** a separate account approves this
   disposable test PR at exact head. GitHub should say mergeable/clean, but
   no one executes a merge.
3. **New harmless reviewable change:** append a test-only phase marker,
   rerun real required CI green, and verify previous approval is dismissed
   or does not satisfy the most-recent-push rule. No fresh approval yet.
4. **Fresh approval on latest green head:** a separate reviewer approves.
   Confirm eligibility is restored without merging.
5. **Red CI on separately approved head:** introduce a test-only intentional
   `assert.fail`; independently approve the intentionally failing head to
   isolate failing CI, verify blocked. Revert the red test and close the PR.

The reviewer is asked to approve only this nonproduction, explicitly
nonmergeable-by-policy **test exercise**, not a product change. Close the
PR without merging after tests, and don't tamper with code on `main`.

## Stage C — new reviewable change

This harmless new paragraph is deliberately added **after** independent
review of the previous commit, to verify that stale approval no longer
qualifies when a reviewable commit changes the proposed pull request.

No real software, CI workflow or task evidence was changed. Never merge.
