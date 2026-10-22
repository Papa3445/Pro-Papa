# PP-0007 — Cross-domain reference-host benchmark (provisional)

## Objective and interpretation

Evaluate the **actual, bounded PP-0006 reference host** against representative user requests. A successful safety check is **not** successful task completion. Neither a private audit receipt nor a JSON provider provenance claim establishes answer correctness. The reference host is explicitly invoked by a Node process; it is not an automatic ChatGPT message router and has no LLM provider, software-authoring handler, document generator, general Q&A engine, or general planning engine.

**Observed first outcome: two of seven requested user tasks were completed; five were safely refused.** This cannot support a claim that Pro-Papa improves general user-task completion versus a direct ChatGPT assistant. PP-0007 must not be closed or labeled generally ready on the strength of these results alone.

## Actual provider-backed execution

- Historical [GitHub Actions run 39708019331](https://github.com/Papa3445/Pro-Papa/actions/runs/39708019331), `check` job `119592520093`: **142 tests passed, 0 failed, 0 skipped**; repository `valid:true`.
- The `pp0007-pilot-observation` job `119592520497` ran both `node bin/benchmark-pp0007.mjs` (deterministic fixture) and `node bin/benchmark-pp0007.mjs --live-research` (actual read-only HTTPS GitHub API request to the single allowlisted repository). Both original complete JSON stdout reports were recovered from authenticated job logs and preserved in `.pro-papa/evidence/PP-0007/historical/`, unchanged; new canonical reports are identified below.
- Historical mock SHA-256: `13bb1681593ec3979a494744803e7bfefe1ddbae825b6ce00ae315bf3fa855d3`; historical live SHA-256: `5f134362591337b004a5d852c91ed7a39e8f9be192410f529e3e162f89e70067`. These are not the current canonical digests.

## Corrected canonical and historical benchmark records

The independent [CHANGES_REQUESTED review](https://github.com/Papa3445/Pro-Papa/pull/10#pullrequestreview-5608563544) identified a real data-integrity problem: an older mock JSON counted a stub as a GitHub GET. The unaltered original mock and live stdout and original observation summary now live at `.pro-papa/evidence/PP-0007/historical/` (original [run 39708019331](https://github.com/Papa3445/Pro-Papa/actions/runs/39708019331)). The previous paths `deterministic-fixtures.json` and `live-read-only-github.json` now contain **new verbatim runner output**, not edited historical data.

Current [GitHub Actions observation run 39711547417](https://github.com/Papa3445/Pro-Papa/actions/runs/39711547417), job `119603801824`, executed unchanged benchmark source blob `347f36e4a28454168ea8e66f6c9973a70b556ce2` using both deterministic fixture and real native public GitHub GET. Exact captured canonical report hashes: fixture `46c51e3c91c02c3a1a21cd836dbfba8228552ed528e4abcccc99fc69543bd80c`, live `b55d8a1d7c6e2bb427cbf969ebbb8b78ac4fb9d4e8df73e585e714b65dcaf938`. Fixture: `totalGitHubCallsObserved=0`, `totalResearchTransportCallsObserved=1`, research `providerCalls=0`, `transportCalls=1`. Live: real GET count `1`, transport calls `1`. The manifest at `.pro-papa/evidence/PP-0007/provider-observation-current.json` binds observed run, source blob, both raw report paths and historic provenance. These counts are source-instrumented host observations, **not packet-level network tracing**. No output-quality superiority or paired direct assistant baseline was measured.

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
