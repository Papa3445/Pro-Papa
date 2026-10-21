# PP-0003 three-domain reproducible pilots

## Purpose and inputs

Run three complete state-machine lifecycles in one disposable local project using the actual `src/core.mjs` and `src/adapters.mjs` implementations. The artifacts are a pure JavaScript boolean decision utility, a source-linked research JSON with three claims from two primary repository documents, and a Markdown handoff guide.

## Verification and measurements

`npm test` executes `tests/pilots.test.mjs`. Each profile goes through creation, dependency scheduling, start, a failing adapter check, corrected source and passing adapter check, separately recorded domain evidence, review-role simulation, closure, save, and reload. Software exercises a real eight-combination truth table and invalid input. Research compares claims to the checked-out primary source text, not just link formatting. Document validation inspects concrete messages about evidence limits.

The test outputs a structured `PP0003_PILOT_REPORT` line with adapter attempts, rework counts, source counts, genuine runtime measurements, and limitations. CI logs preserve the observed output; elapsed time must be taken from an actual execution, not invented in this document.

## Scope boundary

The fixture's reviewer is **simulated by a different actor string**, not an authenticated independent reviewer. That is sufficient to test the v0.1 lifecycle but must never be claimed as an external quality review. The top-level PP-0003 task still requires independent review of its production PR before acceptance. Source permalinks are pinned to a previously observed repository commit; local source content is checked against the claims, without claiming live website retrieval.

## Rework and follow-up

One intentionally invalid input is rejected and corrected per domain. Real regressions encountered in this pilot should be fixed in the smallest relevant framework component rather than adding speculative orchestration layers. The pilot observations will be reported after CI has actually executed.

## Recorded outcome

The first GitHub Actions execution passed 68/68 tests, with all three pilots closing after one deliberate failure/rework each. See [actual CI observations](RESULTS.md). Independent PR review is still pending.
