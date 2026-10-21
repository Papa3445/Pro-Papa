# PP-0003 pilot results — actual GitHub Actions execution

**Observed run:** [Verify Pro-Papa #39579645690](https://github.com/Papa3445/Pro-Papa/actions/runs/39579645690), job `119153782678`. **Commit:** `70b1986d854b185b3f884b0545d2ea4efbf3e413`. Node 22 on GitHub Actions. `npm run check` completed with **68 tests passed, 0 failed, 0 skipped**, and repository state validation passed.

## End-to-end outcomes

| Domain | Actual runtime | Adapter attempts | Adapter failures recovered | Domain-specific evidence | Lifecycle |
|---|---:|---:|---:|---|---|
| Software | 102 ms | 2 | 1 | 8 truth-table assertions, invalid-type rejection, real code execution | Verified in temporary project |
| Research | 28 ms | 2 | 1 | 3 claims checked against 2 checked-out primary repository documents | Verified in temporary project |
| Document | 20 ms | 2 | 1 | 4 substantive content assertions and structural Markdown validation | Verified in temporary project |

These times are **test execution durations** from the actual CI job, not estimates of human or AI implementation effort. The first implementation comprised five new pilot artifact/test/methodology files and a roadmap status update, followed by this results report.

**Measured implementation footprint (snapshot at commit `f704027a93eaee5bf1a2d165a433aeada3121571`):** 7 changed files, **240 added lines and 3 removed lines**, across the first 2 commits. Later documentation-only commits are excluded from these snapshot figures. The first two commit timestamps are `2026-10-21T09:47:08Z` and `2026-10-21T09:48:43Z` (95 seconds apart). This is **commit-history elapsed time only**, not measured active engineer/model effort; the true authoring effort remains unknown.

## What the test actually proved

The new `tests/pilots.test.mjs` created a fresh project and three dependency-ordered tasks, rejected premature starts, called each real built-in adapter with invalid and corrected inputs, recorded separate artifact/domain/validation/review-role evidence, verified that missing evidence blocks closure, closed each task, saved state, and reloaded it. All three states persisted as `verified`. The research pilot verified the content of its source claims against repository documents in the checked-out tree, without claiming live internet retrieval. The software pilot executed an imported pure function and asserted all 8 boolean combinations plus invalid-input rejection.

The three deliberate bad inputs were an invalid JavaScript export, a broken research source reference, and a Markdown placeholder. Each produced a recorded failure, then a passing replacement. **Three reworks were measured**, one per domain.

## Demonstrated limits and priority

- **Review independence:** The fixture uses a separate reviewer *name* only to test the lifecycle, not an authenticated second account. The actual PP-0003 PR still requires a fresh, independently authenticated review before acceptance.
- **Research accuracy:** The primary sources are the project's own checked-out documentation. The pilot confirms consistency with those two sources, not independent real-world truth or live URL fetches.
- **Adapter scope:** Software syntax alone is not a runtime test; citations alone are not a factual audit; headings alone are not substantive document quality. Domain proofs are recorded separately.
- **Implementation effort:** CI durations are not a proxy for engineer/model effort. No credible effort-hours metric was collected; future pilots should record actual operator time if that is a decision criterion.
- **Failure analysis:** No framework defects were observed in this execution, so none were altered speculatively. New defects found in independent review must be reproduced and fixed before closure.

## Reproduce

Run `npm run check` from repository root. The test emits a machine-readable line starting with `PP0003_PILOT_REPORT` containing per-domain counts, runtime, rework, source coverage and declared limitations. See `pilots/README.md` for test design.
