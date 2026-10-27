# Development delivery policy — advance, verify once, ship safely

This is the **execution workflow**, not a new task queue, security exception, merge authorization or replacement for `.pro-papa/tasks.json`. Use it when developing Pro-Papa or when the user says **Continue**.

## Default: make the next real change

1. Resume the active task or first dependency-ready task, honoring the user's explicit priority. Identify **one actionable next outcome** (code fix, completed artifact, ready-to-review PR, approved integration decision, or an honestly blocked handoff).
2. Reuse the existing candidate branch, PR, source-pinned test results and independently submitted reviews. **Do not** open a new PR, audit receipt, test branch, manual form or review cycle merely to restate proof already accepted for an **unchanged** SHA, comparison and ruleset.
3. Implement and verify the chosen change, then **advance its state in the same turn** whenever tools and authorizations allow. If blocked externally, give the single actual blocker, its owner and the shortest enabling action. Avoid an endless sequence of "verification next" statuses.
4. Require a **new** exact-head CI run and relevant review **only when the diff/head/base, required check policy, review state or material acceptance changes**. Existing approvals are not transferable to a new comparison; don't assume previously reviewed branches certify an integrated diff.
5. Stop repeating a resolved experiment. After independent review accepts a governance finding, close the issue if authorized or carry forward the explicit accepted proof. Reopen testing only for a **new observed regression, reproducible defect or changed enforcement policy**. Negative controls must never be merged.
6. Keep the source-of-truth task state current: `.pro-papa/tasks.json` owns tasks, acceptance and dependencies. **Merging a development PR does not itself verify a task or authorize a production deployment.** Separate code integration, milestone closure and production release.

## One integration lane, not infinite review scaffolding

For a coherent, already reviewed stack, consolidate **once** into a single integration PR based on the protected branch. Verify its full diff, exact-head GitHub Actions required job (`check`, GitHub Actions app ID 15368 as currently configured) and eligible independent approval **of the integrated PR**. Review errors directly on that PR. Do not create stacked proof/approval PRs or rerun full protection-matrix probes for each integration.

| State | Next action |
| --- | --- |
| Change exists, CI/review pending | Obtain the outstanding check/review **on that PR**, not another PR |
| Real CI failed or review requested changes | Fix the failing code/diff and rerun only affected required checks; get fresh review on new head |
| CI green + current independent approval + native PR eligible | **Ready for merge decision**. Check integration/release policy, then merge **only if an applicable owner authorization exists** |
| Merge authorized and actual SHA-bound protected merge succeeds | Read back main at resulting commit; continue roadmap; do not automatically claim production or task closeout |
| Merge authorization missing | Ask for **one explicit decision** to merge the specific PR or grant standing bounded integration authority; do not create unrelated review probes |
| Production authentication/smoke evidence missing | Keep production release blocked, but do not indefinitely block unrelated safe planning/doc/test integration unless merge actually auto-deploys |

The required status context is the **GitHub-reported check-run name** `check`, not the display text `Verify Pro-Papa / check`. Confirm the live ruleset; never fake statuses or weaken the native check source to resolve a stalled PR.

## Merge authority, autonomy and deployment safety

**No operator may silently reinterpret "continue", "fix the loop", PR approval, or green CI as authorization to merge, deploy, close a milestone or change branch protection.** An explicit per-PR owner approval or **previously granted, still-applicable standing authorization** is needed for the particular action. Standing authorization should name a bounded repository/release lane, merge criteria, permitted action, limits and revocation; it is **not** inferred from documents written by an implementer. Security checks and independent review remain mandatory.

Before any actual merge, check whether changing `main` **automatically triggers Netlify/other production deployment**. If so, do not label the merge "nondeploying" or use integration authority that excludes deployment; obtain appropriate release approval and verify deployment safety first. Protected GitHub approval is not a production security signoff.

For low-risk development with authorized tools, do the work without requesting permission at every reversible step. Ask the user only at actual trust/irreversibility boundaries. When authorization is missing, state one decision, not a copy-and-paste reviewer prompt on every continuation. Reviewer prompts are for actual outstanding independent reviews, and one prompt may cover multiple genuine related gates.

## Efficient evidence and reporting

Report **what changed, what exact-head check/review was observed, what remains blocked, and the next real action**. Citation/receipt is only needed when it adds independently useful evidence; do not create a fresh private GitHub receipt on every unchanged status read. Never equate an audit receipt with task fulfillment, or a passing mock with production evidence. Always be explicit about what was not tested or deployed.

**No artificial task-count, test-count, or GitHub-PR quotas.** Minimize new governance machinery unless a concrete defect demonstrates need; no per-commit red/green security test ceremony after native branch protection has been independently characterized.
