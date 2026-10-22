# PP-0007 — current evidence and comparison readiness

Run `node bin/pp0007-readiness.mjs` to inspect the two **distinct** published reports, verify local structured code/test SHA-256 against the source-pinned observation, and identify blocked original PP-0007 acceptance obligations.

| Study | Real measured scope | Outcomes | Limitations |
| --- | --- | --- | --- |
| Canonical fixed seven cases | 7 original user-style requests; mock research | **2/7** genuinely completed; 5 safe refusals | No freeform Q&A, arbitrary software/document authoring, planning or novel reasoning |
| Additional structured Node host | 4 distinct explicit-input local requests | **4/4** mechanically validated; 5/5 security refusals | Not the same tasks; no real provider calls or per-pilot receipts |
| Direct-assistant paired baseline | **Not performed** | **Unknown** | No external LLM run, quality grade, observed human corrections or comparable token cost |

The readiness audit is a **fail-closed reconciliation**, not a performance claim and not a direct model invocation. It checks full case IDs/outcomes and rejects silent baseline inventions, receipt upgrades, altered negative-case reports, lost source hashes, or mistaken equivalence of distinct task sets. Its output `milestoneAcceptanceMet:false` is intentional, even though the script can exit 0 after successfully checking evidence integrity.

The structured study's recorded initial source code GitHub SHA and CI URL were confirmed separately in PR #14 by its independent reviewer, but this local Node CLI **does not query GitHub for authenticated identity**. It verifies *local source/test digests* and local report consistency. This does not attest to external services, nor prove scientific quality.

To complete acceptance, perform matched real user requests across all six requested categories plus novel/fallback using authorized tools, capture full real assistant and host outputs, independently grade them, measure corrections/cost/latency with stated comparability limits, acquire per-pilot private receipts where available, run exact-head tests and a **new independent milestone review**. Keep PP-0007 `in_progress` until these requirements are genuine. Never use fabricated direct-assistant records as evidence.

## Provider evidence and review gating

The initial PR #15 implementation was tested through the real GitHub Actions push [39726845532](https://github.com/Papa3445/Pro-Papa/actions/runs/39726845532) with **159/159 tests passed**, before this metadata/provenance change. The readiness test now emits exactly one `PP0007_READINESS_REPORT_JSON=` machine-readable marker; a later evidence commit must archive the actual matching GitHub Actions result rather than deriving any synthetic model baseline. The active trusted-review target must point to PR #15 on the previously independently reviewed `main` SHA `3e58f0f5c757d72da8a79274aa6d6565bc49287a`; the older approved PR #14 does not independently approve this code. The milestone stays `in_progress` pending real baseline and all acceptance conditions.

## P2 independent-review findings and corrected trust boundaries

On October 22, 2026, genuine independent [CHANGES_REQUESTED review #5616210670](https://github.com/Papa3445/Pro-Papa/pull/15#pullrequestreview-5616210670) reproduced two faults in the earlier auditor even though its old code had **160 passing tests**: unsafe negative-case status and expected values were self-consistently editable, and timing/output/audit/provenance fields could be mutated while the report still asserted `evidenceIntegrityChecked:true`. This was a historical *validation* defect, not a remote execution finding. Approval from that rejected head is not permission to merge.

The corrected auditor binds each report to the **raw-byte SHA-256 and parsed normalized SHA-256** of the earlier independently reviewed canonical and structured evidence. It also compares ordered negative IDs and statuses to a fixed five-case safe oracle, checks nonnegative finite durations and known per-case output summaries and audit/provenance status, and refuses on mismatch. A new historical report requires a separate review/pin update—edits to the existing reports cannot silently promote a failed case. The SHA constants are repository source control values confirmed against the prior reviewer-attested observations, **not external GitHub authentication by the local CLI**. The tests now mutate unsafe statuses+expectations together, negative IDs, output summaries, negative durations, confirmed audit and forged provider metadata; all must fail closed. Prior passed CI on the uncorrected implementation is not used as final acceptance evidence.

The seven blank paired-trial inputs and the honest original **2/7**, separate **4/4**, **zero observed paired-baseline** measurements remain unchanged. PP-0007 remains `in_progress`. Fresh exact-head CI and independent re-review are required.
