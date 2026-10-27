# F-01 post-correction isolated approval gate verification

**Disposable governance probe — NEVER MERGE.**

This harmless Markdown-only change exists exclusively on
`test/f01-postfix-review-only-20261027`.

Purpose: after native main ruleset #25921403 was corrected to require
the *actual* GitHub Actions check context `check` from app 15368,
observe that a current passing GitHub Actions result **with zero
approving reviews** produces GitHub PR `mergeable_state:"blocked"`
while the pull request is **open**.

Evidence to collect (actual provider state, no guesses):
- Exact PR head and protected main base.
- Exact `pull_request` GitHub Actions success and check run provider ID.
- `GET /pulls/<PR>/reviews` confirming no approvals.
- `GET /pulls/<PR>` returning `mergeable_state:"blocked"`
  while the PR is still open and all required checks passed.
- Full diff shows only this Markdown file.

Close without merging after evidence is recorded.
No production, code, workflow, branch protection or task ledger changes.
