# PP-0007 — Cross-domain reference-host benchmark (provisional)

## Objective and interpretation

Evaluate the **actual, bounded PP-0006 reference host** against representative user requests. A successful safety check is **not** successful task completion. Neither a private audit receipt nor a JSON provider provenance claim establishes answer correctness. The reference host is explicitly invoked by a Node process; it is not an automatic ChatGPT message router and has no LLM provider, software-authoring handler, document generator, general Q&A engine, or general planning engine.

**Observed first outcome: two of seven requested user tasks were completed; five were safely refused.** This cannot support a claim that Pro-Papa improves general user-task completion versus a direct ChatGPT assistant. PP-0007 must not be closed or labeled generally ready on the strength of these results alone.

## Actual provider-backed execution

- [GitHub Actions run 39708019331](https://github.com/Papa3445/Pro-Papa/actions/runs/39708019331), `check` job `119592520093`: **142 tests passed, 0 failed, 0 skipped**; repository `valid:true`.
- The `pp0007-pilot-observation` job `119592520497` ran both `node bin/benchmark-pp0007.mjs` (deterministic fixture) and `node bin/benchmark-pp0007.mjs --live-research` (actual read-only HTTPS GitHub API request to the single allowlisted repository). Both complete JSON stdout reports were recovered from authenticated job logs and saved byte-for-byte after normalization to `.pro-papa/evidence/PP-0007/deterministic-fixtures.json` and `live-read-only-github.json`.
- Mock result SHA-256: `13bb1681593ec3979a494744803e7bfefe1ddbae825b6ce00ae315bf3fa855d3`. Real provider result SHA-256: `5f134362591337b004a5d852c91ed7a39e8f9be192410f529e3e162f89e70067`.

## Seven measured requests

| Category | Request/expectation | Observed status | Requested outcome achieved? |
|---|---|---|---|
| Quick Q&A | Answer the capital of France | `unsupported` | No |
| Sourced research | Retrieve GitHub repository metadata with a provider URL | `completed` | Yes, **limited one-record metadata lookup**, not full sourced synthesis |
| Software | Implement and test a parsing function | `unsupported` | No |
| Document creation | Draft a business memo | `unsupported` | No |
| Calculation/data analysis | Sum `[2,3,5]` | `completed` (sum 10; count 3) | Yes, **simple arithmetic only**, not general analytics |
| Planning/operations | Produce a project schedule | `denied` | No (correctly no authorized planning handler) |
| Novel/fallback | Answer an unusual multidisciplinary request | `unsupported` | No |

**Task completion:** `2/7 = 28.6%`. **Safe noncompletion:** `5/7`. **Fixture expectation pass:** `7/7`; this reflects correct outcomes (including refusals), not task-success quality. The fixture run exercised one in-process fake transport, without a real GitHub HTTP request. The separate native live run made one public GitHub HTTP GET. Historical attached reports predate the counter distinction: the fixture's `totalGitHubCallsObserved: 1` field included a stub invocation and **does not establish a network request**. Updated code reports actual GitHub calls and transport invocations separately. No arbitrary endpoint was called, no issue was posted, no LLM tokens were spent by the host itself, and no private audit receipt was requested by these pilots.

## Explicit safety/negative controls

1. Unallowlisted repository request: `provider_unavailable` and **no outbound call**.
2. Unavailable software handler: `unsupported`, no fabricated program.
3. Unauthorized issue creation: `denied`, no GitHub POST.
4. Injected native private-audit HTTP client: **rejected**, not `confirmed`.

All 4 checks passed. These are limited host boundary checks; they do not imply safety against all adversaries.

## Actual persistence and timing

The benchmark also initialized a real, isolated disposable Pro-Papa project in the GitHub runner, executed `math.sum([9,11])` under durable tracking, checked the saved task record, retried the **same UUID**, confirmed `already_executed` and `gatewayRun:'completed'`, then deleted the temporary project. **One real temporary task persisted during this probe**; the benchmark did not add user projects or any production task records. This proof is distinct from the public PP-0007 milestone ledger.

Observed **single-sample** host handler time in the real-provider job: research `212.754 ms`; local sum `0.322 ms`; temporary durable run/retry `11.166 ms`. These exclude process startup and are sensitive to GitHub network and CI host variance. They are not p50/p95 distributions or service-level guarantees.

No actual corrective user interactions were observed during automated fixed-input requests. The field `correctionInteractionsObserved:0` means the script asked for no correction, **not** that a human would require zero follow-ups. Tool call counts measure fixed GitHub requests and completed local handlers, not hidden LLM work. **Token overhead is unmeasured** (no LLM/token meter), and **a comparable direct-assistant baseline is unavailable** (no direct LLM provider or controlled paired experiment is configured). Comparing these timings or metadata fetches against invented direct-assistant numbers would be invalid.

## Reproduce safely

From the repository checkout using Node.js 20+:

```sh
npm run check
npm run benchmark:pp0007
node bin/benchmark-pp0007.mjs --live-research
```

The default command is deterministic except for local timings; the `--live-research` command performs **one real public read-only GitHub GET**. The benchmark needs no GitHub write token, produces no issue, and removes the temporary durable project. The test suite `tests/benchmark-pp0007.test.mjs` checks seven-category coverage, statuses, negative outcomes, injected-vs-native network accounting and durable tracking. Actual GitHub Actions logs provide independent provider execution evidence; the local test with injected fake fetch alone does not.

## Baseline and remaining acceptance gaps

The task's original objective asks to **prove improved real-user outcomes across domains** and compare to a simple direct-assistant baseline. The current host demonstrably fails to complete five of seven representative user tasks. This is not an optimization success. Before a scientifically meaningful comparative readiness claim, the project needs:

- Explicit approved integrations or handlers for Q&A, software, document and planning tasks (with output-quality evidence), or an intentionally narrower agreed product scope.
- A reproducible paired baseline that calls a real direct assistant with the same tasks and objectively grades content or artifacts, with comparable elapsed time, tool calls, follow-ups and token accounting where available.
- Multiple samples, external quality verification, negative-case coverage, and independent GitHub review of benchmark design and evidence.

Until then PP-0007 should remain **in progress or blocked**, even if its benchmarking tools pass CI. Do not use a `confirmed` audit receipt or `validationPassed` test-field as a substitute for outcome quality. No code change should silently revise the PP-0007 acceptance criteria to call 28.6% general-task completion a success.
