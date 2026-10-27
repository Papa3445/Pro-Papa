# PP-0007 gate 007-B — recovered secondary historical reports and owner decision

**Status: partial evidence reconciliation, not completed comparison or milestone closeout.** Prepared using public `main` commit `39076ac85a6864dd007b9ed6c947389548878508` and existing privately stored October 23, 2026 narrative reports. The per-case [machine-readable summary](../fixtures/pp0007-007b-historical-reconciliation.json) publishes no screenshots, transcripts, private file links, raw responses or software sources. `PP-0007` remains `in_progress`, and the canonical fixture remains unchanged.

## Newly located secondary records and the actual recovery limit

A live search of files accessible to the operator found and **read two historical private Library reports**: an operator-created seven-case ChatGPT website comparison summary and a different assessor's October 23 nonblinded critique of **that summary**. This is **new accessibility to secondary evidence**, not recovery of the 35 purported original screenshots (15 regular, 20 Project), all 14 raw answers, both runnable parser ZIPs, model details, or complete source transcripts. A search of the current conversation yielded zero matching original uploads; targeted private Library search found the two summaries, not authenticated underlying per-case originals. These negative search results are bounded by current tool indexing and search scope: the files may exist elsewhere. The archive itself says the assessor did not inspect the original screenshots or rerun the code.

The secondary reports attribute original seven-case prompts to the frozen fixture Git blob `aa07d8296ab8c4ad492ec02863bd4203bb90ead4`, but this increment **did not independently verify the actual submitted per-arm prompt bytes**. The source index cannot authenticate a third-party conversation from an author summary. Do not treat screenshots described in the narrative as raw evidence inspected today.

## Two historical score families — different rubrics, never combined

| Historical assessment | Regular ChatGPT | Pro-Papa2 ChatGPT | Proper interpretation |
| --- | ---: | ---: | --- |
| Previously published retrospective grade report (different nonblinded rubric) | **18/21** | **21/21** | Historical reported result, **not** prospective study data, independent case authenticity or a causal effect |
| Newly accessible October 23 assessor's **post hoc 0–4-per-case** rubric | **21/28** | **23/28** | Reviewer judged a *secondary narrative*, not underlying original artifacts. Provisional, not an official framework score |

Both may describe overlapping observations of seven cases. Their denominators/rubrics differ, and **they are not two independent replications**. A two-point project lead on the new 0–4 rubric is entirely sensitive to whether appropriate clarification counts as well as a self-chosen novel example, and whether the missing baseline parser would pass the same held-out verification. Do not calculate a combined percentage, winner probability or independent evidence count from these summaries.

The recovered post hoc scores by original canonical case:

| Case | Regular / 4 | Project / 4 | Evidence-constrained reading |
| --- | ---: | ---: | --- |
| Q&A | 4 | 4 | Both reportedly answered Paris; factual truth is independently checkable but original output identity isn't |
| Research | 3 | 3 | Both reportedly supplied useful metadata; project tool/source authenticity and equal permissions unverified |
| Software | 2 | 3 | Project ZIP/report of checks was described; baseline ZIP missing; asymmetric artifacts prohibit true algorithm comparison |
| Document | 3 | 3 | Both reportedly wrote memos; full texts not inspected in this increment |
| Data | 4 | 4 | Both reportedly answered 10; trivial arithmetic is checkable, original response provenance isn't |
| Planning | 3 | 3 | Different planning contexts and assumed constraints; neither schedule shown executed |
| Novel/fallback | 2 | 3 | Project reportedly chose a worked hypothetical; baseline's clarification was appropriate for underspecification |

**No recovered record establishes a newly verified per-case grade or user-task success.** The validator enforces `taskCompletionIndependentlyVerified:null` for both arms of all seven cases.

## What timing labels can and cannot support

The archived report lists UI *Worked for* labels, in **seconds**, not standardized submission-to-final-answer wall-clock durations:

| Case | Regular label (s) | Project label (s) |
| --- | ---: | ---: |
| Q&A | unknown | 38 |
| Research | 26 | 52 |
| Software | 183 | 280 |
| Document | unknown | 52 |
| Data | unknown | 49 |
| Planning | unknown | 126 |
| Novel/fallback | unknown | 71 |

**Only research and software contain labels for both arms**. Even those show solely that the *reported UI label* was longer for the project (research 52 versus 26; software 280 versus 183); the implementation, tool/context access, task scope, timing boundary and artifact reproducibility are not matched. Unknown labels are `null`, never zero. No actual provider token meter, correction count, comprehensive tool-call trace, independent timing metric or quality-adjusted labor cost is available. Gate 007-D can reference these reported values as historical labels only; do not pool them with Node local handler milliseconds or separate image/PDF trials.

## Owner acceptance is recorded; technical research remains open

The product owner explicitly **accepted personally perceived better practical usefulness** on October 25 and authorized continued framework development. See [PR #32](https://github.com/Papa3445/Pro-Papa/pull/32), where this product decision is recorded and independently approved as a truthful **owner signoff statement**, not a scientifically authenticated outcome. The decision **does not remove** the original four PP-0007 acceptance conditions, grant GitHub reviewer approval for its final closure, settle performance overhead, or authorize retrospective backfilling of the [frozen prospective 42 observations](../fixtures/pp0007-ui-v2-contract.json). The original host results (1/7 ungranted and 2/7 granted), distinct 4/4 structured pilots and newer owner experience are **different study arms**; they cannot be aggregated.

### What is genuinely reusable now

- Immutable seven-case task identities, independent source hashes, published native-host/structured CI and permission boundaries.
- Narrative statements from recovered private secondary reports **as descriptive, post hoc, operator/reviewer-reported** historical context, not authenticated participant output or blindly rated artifacts.
- The owner signoff **as an operational product decision** without repeated owner-only "is it faster?" tests.
- Two historical paired **UI labels**, with explicit unequal boundary/permissions and no general latency comparison.

### Unresolved verification gates

- **Private original recovery:** identify/inspect the original 35 screenshot files, complete 14 response transcripts, both parsers and raw test records where they actually exist; retain private provider/config metadata. Do not publish screenshots or transcript text.
- **Permission and content parity:** original sent-prompt hashes, model/options, tool grants, Project context, date, correction turns and independent authenticity/quality ratings. A post hoc narrative rubric is not a previously frozen prospective rubric.
- **Symmetric software/quality:** test both available parser artifacts under an identical acceptance oracle; treat unavailable source as unavailable, never as failure or success. Independently inspect open-ended memos and schedules rather than merely counting text.
- **Separation and closeout:** continue PP-0007 gates 007-C/007-D/007-E. Only an appropriately scoped, genuine independently reviewed 007-F closeout PR may revise trusted-review pins and task status after actual acceptance or a transparent separately reviewed owner-authorized change in scope.

## Reproduce and independently challenge the privacy-safe summary

`tests/pp0007-007b-historical-reconciliation.test.mjs` verifies the frozen original fixture identity/unchanged trial slots, the recovered **21/28 vs 23/28** arithmetic from seven listed interim scores, exactly **two** reported paired UI-label cases, explicit nulls for missing metrics, and honest separation from **18/21 vs 21/21** and unexecuted **0/42**. The tests challenge the **published summary contract**, not the private report's authenticity, screenshot completeness, provider execution or subjective quality. No script makes a new model call, downloads private records or creates new graded observations.

Provider CI and a fresh independent review are required on the final PR head before this documentation increment can be called independently reviewed. **Do not merge, close PP-0007 or declare scientific superiority solely from this report.**
