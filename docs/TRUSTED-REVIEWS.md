# Authenticated independent GitHub review (PP-0002)

This feature **reads authenticated GitHub review records** before a formal task can close. It does not generate an AI review, automatically merge a PR, or write a status-check result. GitHub proves account identity and the recorded decision, not that the reviewer was diligent or a distinct person.

## Configure a formal task

The review target may be pinned to the intended comparison base:

```json
"requiresTrustedReview": true,
"reviewTarget": {
  "repository": "Papa3445/Pro-Papa",
  "pullRequest": 2,
  "baseRef": "main",
  "baseSha": "bd16037bb74bbfc5abc39bb3bd9763cc2a880ac8"
}
```

`reviewTarget.baseRef` and `baseSha` must be set together. Record these from a **trusted, previously approved baseline** before review; do not replace them with whatever the current PR base reports after retargeting. Matching a repinned base does not prove the earlier approval covered the altered diff. Unpinned historical targets remain supported but authenticate only the *PR head*, not its comparison base.

File-backed review evidence must identify a reviewer distinct from the implementer. For an opted-in task, the reviewer must match a current-head GitHub-approved account and no unresolved changes request may remain. A change request on an older head still blocks until the same reviewer approves the new head or GitHub formally dismisses that particular review ID.

With a host-managed **read-only** GitHub token, run:

```bash
node bin/pro-papa.mjs review-status --id PP-0002
node bin/pro-papa.mjs close --id PP-0002
```

`review-gate --repo OWNER/REPO --pr NUMBER` is a **head-only diagnostic**, not a branch-protection substitute or reviewable-diff certification. A task's opt-in/pin and CLI invocation are repository-controlled, not an access-control boundary; protect baseline changes separately.

The verifier uses a fixed GitHub HTTPS endpoint, two complete review snapshots and three PR identity reads. It validates the head SHA, base ref/SHA/repository, author and review decisions; rejects malformed decisive records and unknown review states; and fails closed on changes visible during lookup. GitHub REST cannot make lookup, closure, and merge atomic. Use an expected-head-SHA condition when merging and recheck review state.

## GitHub branch protection and workflows

This repository deliberately **does not publish custom review-approval commit statuses**. An experimental status publisher was removed because an untrusted same-repo workflow could issue an identical GitHub Actions status, while different PRs can share a commit SHA/status context.

Where available on your GitHub plan/repository, configure native branch protection or rulesets on `main` to:

- Require pull requests and approval from eligible independent reviewers.
- Dismiss stale approvals on new pushes and, where supported, require approval of the most recent reviewable push.
- Require the ordinary `Verify Pro-Papa / check` CI result.
- Restrict bypass privileges and avoid allowing PR authors to approve their own work.

An administrator must configure these settings; their exact availability depends on repository plan and visibility. They govern **merging**, while Pro-Papa `close` verifies the separate opt-in task evidence. Neither automatically generates an independent AI review.

There is **no** custom `pull_request_review` Actions workflow with `statuses: write`; ordinary `pull_request` CI only runs untrusted code with non-privileged permissions. Never grant status-writing authority to workflow definitions supplied by an unreviewed PR.

## Trust boundaries

- GitHub records authenticate reviewer accounts and decisions, not the quality of their analysis or true real-world independence.
- A repository author able to rewrite a locally stored base pin can undermine its historical meaning; preserve the pin with a separately trusted process.
- Native protected-branch rules, not the Pro-Papa CLI, enforce whether a PR can merge.
- Reviews or the base may change immediately after the final API read; use SHA-bound merge operations and consult current GitHub protection at merge time.
