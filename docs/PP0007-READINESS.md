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
