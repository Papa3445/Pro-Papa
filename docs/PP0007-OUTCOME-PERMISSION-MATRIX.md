# PP-0007 gate 007-A — canonical outcome and permission reconciliation

**Scope:** source-pinned historical audit at public `main` commit `39076ac85a6864dd007b9ed6c947389548878508`. This increment adds a machine-readable [matrix](../fixtures/pp0007-outcome-permission-matrix.json) and fail-closed contract regression test. **No new ChatGPT trials, model calls, OAuth tests, artifact inspections or provider observations were performed to create these records.** The authoritative task ledger retains PP-0007 as `in_progress`; the independent roadmap PR [#32](https://github.com/Papa3445/Pro-Papa/pull/32) has not been merged as of preparation.

## Frozen canonical seven cases

Read the **original** fixture [`pp0007-paired-trial-collection-template.json`](../fixtures/pp0007-paired-trial-collection-template.json), Git blob `aa07d8296ab8c4ad492ec02863bd4203bb90ead4`. Its objective, capability and optional canonical JSON input are the immutable prompt identity for future comparison; neither fixture nor its still-null original trial slots is modified here.

| Case | Original request | Native reference host *without* external grant | Native host result | Canonical regular ChatGPT and Project output, verified here |
| --- | --- | --- | --- | --- |
| `qa` | Capital of France | No general-Q&A handler | `unsupported`, **not completed** | No / No |
| `research` | Public repository metadata with URL | GitHub read not granted | `denied`, **not completed** | No / No |
| `software` | Implement and test date parser | No freeform software-authoring handler | `unsupported`, **not completed** | No / No |
| `document` | Write formal recommendations memo | No freeform document handler | `unsupported`, **not completed** | No / No |
| `data` | Sum `[2,3,5]` | Built-in `math.sum` permitted | `completed` with `{total:10,count:3}` | No / No |
| `planning` | Produce safe weekly project schedule | No authorized operations effects | `denied`, **not completed** | No / No |
| `novel` | Explain unusual multidisciplinary tradeoffs | No general-reasoning handler | `unsupported`, **not completed** | No / No |

All **seven native executions** were actually called in a GitHub Actions test at [run 39889956053](https://github.com/Papa3445/Pro-Papa/actions/runs/39889956053), using the frozen case IDs/objectives/inputs, with **one completed handler out of seven**, two denied, four unsupported; each had zero GitHub transport attempts. See [original native-host report](PP0007-NATIVE-HOST-TRIAL-2026-10-23.md) and [source test](../tests/pp0007-native-seven-host-study.test.mjs). The result's `taskSuccess` and `qualityGrade` fields were **null**; the table's "completed" is a mechanically checked handler return for math, not a quality grade.

## Research permission difference — do not silently pool arms

With a separately **trusted** `githubRead:true` permission, one native research host attempt returned `completed` using the allowlisted public repository GET, instrumenting one transport attempt (packet confirmation unknown). The original [historical 7-case provider benchmark](PP0007-BENCHMARK.md) used explicit research access and reported **2/7 requested outcomes**: research metadata and arithmetic, not the **1/7** of the ungranted original host study. Its source-pinned [provider evidence index](../.pro-papa/evidence/PP-0007/provider-observation-current.json) distinguishes one real GitHub GET in the live arm from one *fake transport invocation* and **zero real GETs** in the deterministic mock arm. Research tool permission differs from the text-only API collector and potentially from direct ChatGPT: no fair provider/model comparison follows from combining the records.

Both historical configurations had **no provider writes, no per-case private audit receipt and no general model reasoning provider**. Denial of an ungranted call is correctly safe behavior **but does not satisfy the user task**.

## Separate evidence families, not additional scores for the original seven

| Source family | Observed or reported | Why it cannot be merged with the canonical 7 |
| --- | --- | --- |
| [Structured host pilots](PP0007-STRUCTURED-PILOTS.md) | **4/4** fixed-input tasks mechanically validated; five adversarial requests correctly refused; no external provider calls | Different prompts, typed handlers and permissions; no freeform document quality or code-generation comparator |
| [Production OAuth MCP integration, issue #24](https://github.com/Papa3445/Pro-Papa/issues/24) | Explicit ChatGPT-originated math/text/research calls; five bounded anonymous/invalid-bearer denial checks in reviewed PR #29 | Capability-specific positive/negative tests, not seven complete responses, general JWT assurance or global ChatGPT interception |
| [Historical screenshot reuse audit](PP0007-EXISTING-BASELINE-REUSE-AUDIT.md) | Reported retrospective **18/21 regular vs 21/21 Project** across 35 screenshots; seven operator-supplied regular baseline screenshot sets reported | Raw original transcripts/screenshots and baseline software ZIP **not inspected here**; provider identity, per-case grades, prompt parity and tool parity unverified; reported scores cannot be backfilled |
| [Native Project artifact observations, issue #24](https://github.com/Papa3445/Pro-Papa/issues/24) | Independently inspected two-page operations PDF with arithmetic; native image delivery qualitatively reported, but its particular proof is not uniformly verified | Different input task, not the original canonical memo case; image assertions require inspectable source before being counted |
| [UI-v2 frozen prospective contract](../fixtures/pp0007-ui-v2-contract.json) | **0/42 collected** (21 pairs planned) | Unexecuted future-only protocol; past material cannot be relabeled as new trials |

## What was actually performed and what remains unknown

**Authorizations/execution:** original reference host ran locally under fixed tool policy; original research lacked permission, a **separate** read-granted research request executed an allowlisted GET, and arithmetic completed locally. The structured host has distinct fixed handlers. The MCP integration has separately verified limited production behavior. Native ChatGPT Project PDF/image capabilities must not be confused with Pro-Papa reference host capabilities.

**Artifact inspection:** the arithmetic total `10` is objectively checkable, and historical structured outputs passed mechanical validation. A prior Project PDF was independently examined in a different task context; the canonical `software`, `document`, `planning`, `qa` and `novel` user-facing outputs were **not** recovered and newly inspected for this gate. No equal-code runnable ZIPs or complete baseline-to-Project transcripts were available here.

**Evidence and measurements:** per-case quality grades, original screenshot authenticity and output-parity checks, human correction counts, model identity/settings, provider token usage, comparable end-to-end elapsed time and cost remain `null` or unverified. Node host call milliseconds from [native trial](PP0007-NATIVE-HOST-TRIAL-2026-10-23.md) must **not** be compared to UI elapsed labels. Neither the historical receipt nor a CI pass independently proves assistant task quality.

**Release state:** This is **gate 007-A source reconciliation only**. The original PP-0007 acceptance remains unmet: independently verify recovered private baseline/project outputs and permissions where available; account honestly for missing corrections/overhead (007-B through 007-D); review inspectable privacy-safe artifacts and source/auth claims (007-E); then use a **separate** current-head reviewed closeout PR (007-F). No new completion grade or prospective paired observation is claimed.

## Mechanical safeguards

`tests/pp0007-outcome-permission-matrix.test.mjs` compares the machine-readable matrix to the original fixture on **ID, order, reference-host expected statuses and outcome/permission invariants**. It hashes the original fixture's exact Git blob bytes, checks no unsupported/denied result is counted as completed, enforces null/unknown comparative fields, and keeps the separate 2/7, 4/4, 0/42 and retrospective populations disjoint. These are **contract tests**, not authenticated screenshot review, provider-network proof or independent technical approval.
