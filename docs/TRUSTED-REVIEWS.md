# Trusted GitHub independent review (PP-0002)

The GitHub-backed gate **verifies** a real review, not the review's quality or existence of another AI. No Copilot subscription is required; a separate ChatGPT account/context or human reviewer can submit the independent GitHub review.

## Configure a task

After the pull request is opened, set these opt-in fields in `.pro-papa/tasks.json`:

```json
"requiresTrustedReview": true,
"reviewTarget": { "repository": "Papa3445/Pro-Papa", "pullRequest": 2 }
```

A manual evidence file cannot pass this remote check. Ordinary file-backed `review` evidence is still required, with an actor login matching the GitHub-approved reviewer. Other tasks retain previous rules for backward compatibility.

Use a host-managed, read-only `GITHUB_TOKEN` (provided automatically by GitHub Actions), never a token in a task or repository:

```bash
node bin/pro-papa.mjs review-gate --repo Papa3445/Pro-Papa --pr 2
node bin/pro-papa.mjs review-status --id PP-0002
node bin/pro-papa.mjs close --id PP-0002
```

The gate reads the PR and paginated reviews live from the fixed GitHub REST API endpoint. It takes current PR head SHA from GitHub, ignores older approvals, rejects PR-author self-approval, blocks outstanding changes requests, and evaluates nondismissed decisions by each authenticated account. GitHub dismissals update one specific review ID; they never erase unrelated change requests from the same reviewer. Missing credentials, HTTP errors, malformed/incomplete results and mismatched PR identity fail closed. A newer approval by the reviewer can clear that reviewer's changes request.

## Free GitHub Actions integration

The `.github/workflows/review-gate.yml` workflow runs on PR creation/synchronization and review submission/dismissal **once merged into main**. The security-sensitive job checks out trusted default-branch code only. It never runs PR-controlled code with the read-only GitHub token. The normal `pull_request` workflow separately tests candidate code.

After the first gate run, optionally configure a protected `main` branch/ruleset to require `Review Identity / github-approval`. That repository setting requires GitHub administration and is not automatically created by this code.

## Honest limitations

- GitHub proves reviewer account ID, recorded decision and current PR head. It does not prove the reviewer actually read code, or that the human behind another account is independent.
- **The GitHub PR candidate is SHA-bound. The local filesystem is not.** No claim is made that arbitrary local changes are independently reviewed or cryptographically attested. Perform code review before merging and close roadmap tasks from the merged, reviewed revision.
- Task opt-in and PR association are held in repo-controlled state; writers must be governed by normal GitHub permissions and review requirements. Local offline validation cannot authenticate past GitHub reviews.
- A separate reviewer (human or AI process with GitHub review permission) must still submit an approval. Automating the reviewer itself is a separate problem.

A historical changes-requested review remains blocking until the same reviewer approves the exact current head or GitHub formally dismisses that specific review ID. An unrelated dismissed review cannot clear another outstanding objection. Another reviewer's approval cannot bypass it. The verifier re-fetches PR metadata after review pagination to detect head/identity drift.

**Race boundary:** Rechecking the remote head does not make later task closure or merging atomic with future pushes. Use SHA-bound merge operations and branch protection as additional controls.
