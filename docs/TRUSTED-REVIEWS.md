# Trusted GitHub independent review (PP-0002)

The GitHub-backed gate **verifies** a real review, not the review's quality or existence of another AI. No Copilot subscription is required; a separate ChatGPT account/context or human reviewer can submit the independent GitHub review.

## Configure a task

After the pull request is opened, set these opt-in fields in `.pro-papa/tasks.json`:

```json
"requiresTrustedReview": true,
"reviewTarget": {
  "repository": "Papa3445/Pro-Papa",
  "pullRequest": 2,
  "baseRef": "main",
  "baseSha": "bd16037bb74bbfc5abc39bb3bd9763cc2a880ac8"
}
```

The optional `baseRef` + `baseSha` pair pins the intended comparison base. The gate rejects a different target branch or target commit even if the PR head is unchanged. Existing targets without both fields remain head-only for backward compatibility, and must not be described as reviewed-diff-bound. Do not change a pinned base to bypass stale approval without a new review of that exact candidate. A manual evidence file cannot pass this remote check. Ordinary file-backed `review` evidence is still required, with an actor login matching the GitHub-approved reviewer. Other tasks retain previous rules for backward compatibility.

Use a host-managed, read-only `GITHUB_TOKEN` (provided automatically by GitHub Actions), never a token in a task or repository:

```bash
node bin/pro-papa.mjs review-gate --repo Papa3445/Pro-Papa --pr 2  # head-only diagnostic; NOT a required status
node bin/pro-papa.mjs review-status --id PP-0002
node bin/pro-papa.mjs close --id PP-0002
```

The gate reads the PR and paginated reviews live from the fixed GitHub REST API endpoint. It takes the current PR head SHA from GitHub, ignores older approvals, rejects PR-author self-approval, blocks outstanding changes requests, and evaluates nondismissed decisions by each authenticated account. All current-head qualifying approvers are returned in submission order; closure accepts the evidence actor only when that actor matches a qualifying GitHub account. GitHub dismissals update one specific review ID; they never erase unrelated change requests from the same reviewer. Missing credentials, HTTP errors, malformed/incomplete results and mismatched PR identity fail closed. Before reviewer filtering, all undecided APPROVED/CHANGES_REQUESTED records must have verifiable reviewer IDs/logins, submission times and commit SHAs; a malformed, still-blocking request may never silently disappear. A newer approval by the reviewer can clear that reviewer's changes request.

## Free GitHub Actions integration: strict reviewable-diff status

The default-branch `.github/workflows/review-gate.yml` uses `bin/review-status.mjs` with a GitHub Actions token granted `contents: read`, `pull-requests: read`, and `statuses: write`. It checks out **only the trusted default-branch source**, never PR-controlled code.

For every new PR head SHA, the trusted `pull_request_target.opened/synchronize` workflow records a GitHub commit status in context `pro-papa/base-pin`, encoding the original base ref and full base SHA. Only the **first status** for that head is recognized; later repinning does not replace it. The status must come from GitHub's `github-actions[bot]` account. Approvals must be submitted **after** the baseline was recorded.

Review submissions/dismissals and PR `edited` events re-evaluate the original pin. A `push` on `main` scans open pull requests targeting `main`, re-evaluates the same trusted pin, and publishes a new result to their **PR head SHA**, not merely to the base-branch workflow run. New head SHA after synchronize gets a fresh pin and must receive fresh review.

Require the **commit status context** `pro-papa/review-integrity` on `main` (preferably restricted to the GitHub Actions app), not merely the name of this Actions job. It is `success` only for a current-head independent approval against the original base identity. A missing pin, an advanced/retargeted base, unresolved changes requests or approval predating the pin produces `failure`. When no baseline exists, an `edited` or review event cannot invent a new one.

**Setup:** Enable the workflow on the default branch first. Enable GitHub branch protection/rulesets that require this status context. For a PR opened before this integration is installed, push a new head commit to establish a fresh baseline; previously submitted approvals are not reused. This status workflow itself cannot configure branch rulesets and cannot force merge protection if GitHub administrators do not enable the requirement.

The older `pro-papa review-gate --repo ... --pr ...` command remains a **head-only diagnostic** for compatibility and must **never** be treated as this strict required status. Task closure may separately use explicit `baseRef` and `baseSha` pins in trusted task state.

## Honest limitations

- GitHub proves reviewer account ID, recorded decision and current PR head. It does not prove the reviewer actually read code, or that the human behind another account is independent.
- **The GitHub PR candidate is SHA-bound. The local filesystem is not.** No claim is made that arbitrary local changes are independently reviewed or cryptographically attested. Perform code review before merging and close roadmap tasks from the merged, reviewed revision.
- Task opt-in and PR association are held in repo-controlled state; writers must be governed by normal GitHub permissions and review requirements. Local offline validation cannot authenticate past GitHub reviews.
- A separate reviewer (human or AI process with GitHub review permission) must still submit an approval. Automating the reviewer itself is a separate problem.
- The trusted baseline is the first GitHub Actions-authored status on a PR head commit. This assumes protected default-branch workflows and correctly configured required-status rules; the GitHub Actions bot identity by itself does not identify a unique workflow. A writer with authority to change trusted workflows or GitHub merge rules can undermine the gate.

A historical changes-requested review remains blocking until the same reviewer approves the exact current head or GitHub formally dismisses that specific review ID. An unrelated dismissed review cannot clear another outstanding objection. Another reviewer's approval cannot bypass it. The verifier reads the complete paginated review history twice, checking PR identity before, between, and after those snapshots. Changed review IDs, states, or candidate bindings detected between reads fail closed instead of reusing an old approval. The PR comparison also checks `base.ref` and `base.sha` across all three reads; unexpected review states fail closed. The latest approval is selected by submission time, not Map insertion order.

**Race boundary:** Comparing two full review snapshots detects in-flight inconsistencies visible between reads, but cannot prevent changes immediately after the last review read or make task closure/merging atomic with future pushes or reviews. Without an explicit pinned base, a target-branch change that happened *before* the first read may preserve a historical approval despite changing the diff. With a pinned base, a mismatch fails closed; the pin must be maintained by a trusted workflow, not derived afresh from an already-retargeted PR. Configure stale-approval dismissal in branch protection for additional defense. Use SHA-bound merge operations and branch protection as additional controls.
