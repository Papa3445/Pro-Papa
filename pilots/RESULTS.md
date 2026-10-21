# PP-0003 — observed cross-domain pilot evidence

## GitHub Actions execution provenance

All values below are taken from **actual completed GitHub Actions test logs**, not projected timings or estimated developer effort.

| Executed candidate | GitHub Actions PR run | Software duration | Research duration | Document duration | Tests |
|---|---|---:|---:|---:|---|
| First implementation `70b1986` | [39579645690](https://github.com/Papa3445/Pro-Papa/actions/runs/39579645690) (push) | 102 ms | 28 ms | 20 ms | 68 passed |
| Original reviewed head `1bf95c6` | [39580091537](https://github.com/Papa3445/Pro-Papa/actions/runs/39580091537) | 67 ms | 16 ms | 11 ms | 68 passed |
| Corrected audited pilot `99dff88` | [39588408511](https://github.com/Papa3445/Pro-Papa/actions/runs/39588408511), job `119182963457` | 105 ms | 34 ms | 28 ms | 68 passed, 0 failed |

The PR also had a **real failed CI run** on interim commit `5116b1f` ([run 39587798345](https://github.com/Papa3445/Pro-Papa/actions/runs/39587798345)), because the harness still expected two adapter attempts even though the revised research and document examples each had three. The harness was corrected and rerun; that failure must not be omitted from the rework history. These millisecond figures represent **test execution only**, not task authoring effort.

## Pilot outcomes — corrected run

| Domain | Adapter attempts | Structural failures corrected | Substantive audit rejections | Revisions of adapter input | Genuine verification |
|---|---:|---:|---:|---:|---|
| Software | 2 | 1 | 0 | 1 | Eight truth-table combinations, one invalid-type rejection, actual imported function execution |
| Research | 3 | 1 | 1 | 2 | Three **specific propositions**, matched to supporting excerpts in two checked-out primary sources; a false claim with valid citation IDs was rejected by the substantive audit although the structure adapter passed |
| Document | 3 | 1 | 3 | 2 | Three complete curated sections, each bound to explicit supporting source excerpts; contradictory prose, keyword-padding, and altered primary-source evidence were rejected by the substantive audit |

**Three domain lifecycles completed, three adapter failures recovered, four substantive audit negative cases rejected.** Each domain task was created, assigned dependencies, started, checked, corrected, given separately recorded domain evidence, closed and round-tripped through persisted state. Reopened state verifies **every proof file SHA-256**, preventing later test stages from silently overwriting an earlier task's evidence.

The research audit is deliberately small and transparent. `pilots/validation/content-audits.mjs` requires **exact wording for three reviewed assertions**, a fixed citation mapping, the correct pinned source URLs, and explicit supporting excerpts in the actual checked-out `docs/ADAPTERS.md` / `docs/SECURITY.md`. An unapproved false claim cannot pass merely by citing a real source ID. This does not fact-check arbitrary new prose or fetch current external URLs.

The document audit uses an explicit complete-section editorial rubric, verifies factual/supporting excerpts for each section against those two source documents, and rejects contradictory or additional unapproved guidance. It is a **bounded golden editorial contract**, not a general natural-language understanding or quality assessment. The Markdown adapter remains a separate structural check.

The sample `review` evidence uses a **simulated reviewer name** exclusively to exercise the untrusted local state-machine role separation. It does not certify authenticated independent review. Real independent GitHub review is still required for the top-level PP-0003 PR.

## Implementation effort and review rework

**Measured review-remediation session:** The tool-driven correction session started at `2026-10-21T10:49:28.337934190Z` (an explicit terminal clock read when work began) and the first green run containing the final substantive source-backed audits logged the completed pilot observation at `2026-10-21T10:57:55.6613335Z`. Difference: **507.323 seconds, approximately 8 minutes 27 seconds**. This is a bounded wall-clock **implementation/verification session interval**, including code work, GitHub tool overhead and CI queue/test waits. It is **not** active hands-on or billable engineering time. The earlier initial implementation session was not instrumented, so complete lifetime person/model hours remain **unknown**, explicitly rather than guessed.

**Measured PR implementation footprint at commit `99dff88e29c9c02e23a5f76e5347a9873db518b7`:** eight changed files, **439 additions and three deletions**, across eight commits. These figures are a GitHub diff snapshot, not a conversion to labor hours. Reviewer-triggered rework includes new substantive audit rules, valid-citation falsehood and wrong-document negative tests, evidence-filename isolation and post-reload digest verification, plus the fixed interim CI regression. The per-domain adapter revision counts are instrumented in the test rather than copied from a proposed plan.

## Limitations and next decision

- **Accuracy:** Only three predefined claims and a curated guidance document have substantive bounded checks. The same validators are not safe to reuse as a generic fact checker.
- **Source independence:** Primary source materials are this repository's pinned documentation, not independent third-party evidence. No network source retrieval occurred in the pilot.
- **Review authentication:** Inner fixtures simulate the review role; PP-0003 itself is still awaiting a real, external GitHub review of the final PR head.
- **Effort measurement:** A genuine correction interval was captured; full initial authoring effort remains unknown. Neither CI milliseconds nor commit timestamp gaps should be presented as active implementation labor.
- **No speculative framework changes:** The existing state machine and adapters passed the cross-domain lifecycle tests, so only pilot validators, tests and evidence were revised.

## Reproduction

Run `npm run check` from the repository root. `tests/pilots.test.mjs` emits a `PP0003_PILOT_REPORT` line with observed per-domain adapter calls, failures, substantive rejections, source counts, scenario revisions and runtime. See [pilot methodology](README.md). Complete CI logs are linked above.
