# Pro-Papa development roadmap — owner acceptance and PP-0007 closeout

**Decision date:** 2026-10-25. **Authoritative task queue:** [`.pro-papa/tasks.json`](../.pro-papa/tasks.json). This document is a scoped *explanation* of the queue, not a second task-state store. Status/ordering and closeout decisions come from the task queue and live provider evidence.

## Owner acceptance versus research claims

The project owner explicitly stated on 2026-10-25: **"I am self approving that the performance is confirmed better."** Record this as **owner acceptance of better day-to-day usefulness in their own testing and approval to continue development**, including observed working native image and PDF creation, automatic GitHub reads/receipts and MCP smoke calls.

**Do not translate this into** independent reviewer approval, a controlled or causal superiority claim, verified improvement percentages, a pass for still-uncollected paired observations, or automatic proof that the MCP governed whole ChatGPT responses. Owner approval satisfies the *product decision*, **not** every original PP-0007 engineering/measurement/review acceptance item. The original task remains `in_progress`; its four existing acceptance strings and 82 existing historical evidence records are preserved unchanged. No performance test is silently backfilled or retrospectively rescored.

### What we actually know at this boundary

- The original fixed seven-case **standalone reference-host** run completed **2/7** requested outcomes (bounded research and math); five were safely unsupported/denied. The separate ungranted host run completed **1/7**. These are *not* failures of the ChatGPT native image/file tools.
- Different additional structured host pilots mechanically validated **4/4** tasks with distinct input contracts. Do not pool their denominator with the original seven.
- The *historical*, nonblinded website screenshots were described as **18/21 regular** versus **21/21 Project**, with asymmetric software ZIP availability. That descriptive result and the owner's acceptance are useful history, **not** a matched prospective statistical comparison. See [historical reuse audit](PP0007-EXISTING-BASELINE-REUSE-AUDIT.md).
- A genuine OAuth-connected, Netlify-deployed **read-only MCP** returned checked/released `math.sum`, `text.metrics`, and allowlisted repository research. [Approved and merged PR #29](https://github.com/Papa3445/Pro-Papa/pull/29) tested five real negative-auth HTTP cases, including no bearer and invalid bearer. These checks are bounded; they do not establish the full JWT adversarial matrix.
- ChatGPT Project tests produced real native images and a two-page PDF. The actual privately uploaded Weekly Operations PDF was independently inspected for two pages, correct 2+3+5=10 workload, percentages, legible typography and sensible operational actions. [Issue #24](https://github.com/Papa3445/Pro-Papa/issues/24) documents corroborating ChatGPT-originated Netlify MCP POSTs, but does not expose exact method payloads or demonstrate global interception. GitHub receipts independently verify source-file reads and private writes, not artifact quality.

## PP-0007 — remaining work, broken into checkable gates

| ID | Remaining closeout gate | Current evidence / gap | Completion evidence required |
| --- | --- | --- | --- |
| **007-A** | Consolidated **seven-category** outcome matrix | Original seven reference-host outcomes, structured host, and separate ChatGPT Project anecdotes exist under different scopes. | Pin the original seven immutable prompts and report actual task outcome, tools/capability, authorizations, real/simulated execution, output inspection and `unknown` fields for each arm. Distinguish unsupported/denied from user-task completion. Do not claim that 2/7 is 7/7. |
| **007-B** | Honest baseline comparison and **owner signoff** | Owner **has accepted** practical performance as better. Historical descriptive baseline is not a prospective matched dataset and baseline software ZIP is missing. | Record this owner-accepted practical decision explicitly. Reuse any recoverable private original evidence; compare only genuinely common inputs/permissions. Report gaps, corrections, task success and possible quality conclusions, with unsupported comparative metrics marked unavailable. No claim of scientifically verified superiority. |
| **007-C** | Negative cases and trust/security limits | Actual OAuth/MCP positive and bounded anonymous/invalid-bearer negative tests exist. Wrong-scope/audience/issuer and all-turn interception remain unproven. | Produce a current source-pinned checklist of covered and not-covered cases; retain safe-denial artifacts and provider request logs. Treat stronger live JWT tests as a separate optional **future security milestone**, unless needed to make a specific deployment safety claim. |
| **007-D** | Overhead and correction accounting | Some ChatGPT UI labels (e.g. about 1m41s PDF and 2m32s direct tool plus receipts) are observed. Node call time, UI time and total usage are not directly comparable; token use and corrections often missing. | Report real measurements and their sources/units where available, and otherwise use `null`/unknown. **Owner explicitly accepts current responsiveness**; no mandatory speed-optimization work is implied. |
| **007-E** | Consolidated artifact/evidence review | Native PDF content and image delivery were witnessed in separate Project tests, and exact-result MCP smoke tests exist. Full original transcript/ZIP recovery is incomplete. | Publish only non-sensitive outcome summaries, hashes, CI URLs, method limits and reviewer-accessible proof. Preserve user screenshots, PDFs, private conversation details and credentials outside public repository. |
| **007-F** | Formal **closeout gate** | `.pro-papa/tasks.json` remains `in_progress`, and its historical `reviewTarget` points at merged PR #27—not any future closeout candidate. | Scoped closeout PR, current exact-head passing CI, genuine **new independent** review by account separate from implementer; only after all *still-applicable* acceptance obligations are genuinely satisfied or a separately reviewed owner-authorized scope change is approved, update `reviewTarget` and transition task state through the required evidence process. Do not self-approve independent review. |

### Benchmark policy

The frozen UI-v2 proposal of **7 cases × 3 repetitions × 2 arms = 42 fresh conversations** remains **unexecuted**. The owner is not requesting it as a prerequisite to proceeding with practical development. It is an **optional later scientific-comparison study** with its own preregistered contract, not something to relabel using historical screenshots. Keep the original fixed seven cases intact. If the original PP-0007 comparative acceptance is changed, make that a transparent, versioned scope decision in an independently reviewed PR; do not erase the previous wording or change historical reports.

## Next development after PP-0007

The pending, measurable tasks below are added to the **authoritative task ledger**. All depend on PP-0007 being formally verified; only one task can be active in the current runner.

| Order | Task | Outcome / explicit limit |
| --- | --- | --- |
| 1 | **PP-0008: MCP artifact validation** | Add a safely bounded **read-only** PDF/document/artifact verification capability, e.g. PDF page count, extractable text, reported calculations, source-file hash. Explicit user-granted inputs, size/type caps, malformed/oversized negatives, no raw private content in public logs. A check report is not proof of subjective quality. |
| 2 | **PP-0009: Tool-specific observability** | Bind a selected MCP capability/request ID/result and release trace to the actual invocation; allow private correlation without recording raw prompts. Distinguish connectivity from task execution; include privacy and forged-claim negatives. No unsupported always-on ChatGPT interception claims. |
| 3 | **PP-0010: Optional host-enforced release gate** | Prototype a separately controlled gateway that can block release when configured validators fail on a submitted artifact. Provide bypass/denial tests and documented scope. Do **not** assert it can intercept all standard ChatGPT Project messages without actual host support. |
| 4 | **PP-0011: Expanded capabilities and user-outcome rollout** | Add approved, permission-limited domain validators and representative document/software/data/planning smoke tests; verify artifacts and rollback boundaries, gather non-sensitive owner feedback. Any statistical superiority claim remains separately studied, not inferred from pilot success. |

## Next executable step

Continue **PP-0007 gate 007-A**: produce a reconciled seven-case outcome-and-permission matrix referencing actual provider/fixture records and recent observed native Project artifacts. Use the matrix to identify the *minimal* evidence needed for the owner-accepted product closeout versus optional stronger comparative research. Follow with 007-B through 007-F, one scoped PR and genuine independent review. Work on PP-0008 starts after the reviewed PP-0007 transition, not automatically because the owner accepted performance.

## Governance and privacy

Do not store personal conversation content, source images, screenshots, PDFs or secrets in the public development repository. Source hashes, bounded summaries and evidence URL identifiers may be recorded when appropriate. Use genuine provider operations; project instructions and MCP traces are not automatic global enforcement. Review and merge changes only against the exact tested head with independent approval.
