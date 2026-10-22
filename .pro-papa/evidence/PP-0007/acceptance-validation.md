# PP-0007 preliminary acceptance validation

**Scope:** reproducible, real host-level benchmark results; **not** an assertion that PP-0007 is complete or that the gateway improves general AI output quality.

## What actually executed
- Actual [GitHub Actions run 39708019331](https://github.com/Papa3445/Pro-Papa/actions/runs/39708019331), check job 119592520093: **142 tests passed, 0 failed, 0 skipped**, repository validation `valid:true`.
- Same provider run, benchmark job 119592520497, actually executed both deterministic mock-GitHub and **real public GitHub GET** variants of `node bin/benchmark-pp0007.mjs`. Both complete sanitized JSON reports were extracted from job logs, committed to file-backed PP-0007 evidence, and read back. Mock SHA-256 `13bb1681593ec3979a494744803e7bfefe1ddbae825b6ce00ae315bf3fa855d3`; live SHA-256 `5f134362591337b004a5d852c91ed7a39e8f9be192410f529e3e162f89e70067`.
- Seven fixed requests cover quick factual Q&A, GitHub provider metadata research, software generation, document writing, calculation, planning, and novel fallback. Only **two completed**: one bounded metadata GET and one local sum. Five were refused without creating misleading text or fake artifacts; the planning operation was appropriately `denied` without a host grant.
- Four explicit negative checks exercised unauthorized repository, missing handler, unapproved external action, and attempted untrusted native audit-transport injection. **All passed**. No external GitHub POST or arbitrary URL occurred.
- A disposable separate Pro-Papa project was really created and saved one `math.sum` durable task, replayed the same UUID with `already_executed`, checked `gatewayRun:'completed'`, and deleted the isolated project afterward. The benchmark did **not** persist a user task ledger or issue a new audit receipt for any of the seven pilot calls. PP-0006's private audit smoke belongs to PP-0006, not these requests.
- Real live research one-sample handler latency `212.754 ms`; local sum `0.322 ms`; durable sum plus replay `11.166 ms`. Node process startup not included. No direct-assistant token/latency comparator, actual human corrections, production throughput or quality assessment were observed.

## Acceptance checklist — evidence not success claims
1. **Partially satisfied:** Seven reproducible category requests were attempted end-to-end through the actual PP-0006 host (real provider used for a read-only repository lookup). Five domains cannot be actually completed due to absent handlers. The repository record is not full independent multi-source research.
2. **Partially satisfied:** Executed handlers, mock vs real provider calls, no-audit status, safe rejections, disposable durable task and host limitations documented. No private per-pilot audit receipts or substantive software/document/planning artifacts exist.
3. **Not yet satisfied:** No measurable comparable direct-assistant baseline, real human corrective interactions or token metering. Data currently **contradicts** a claim of improved cross-domain completion: 2/7 requests completed, 5/7 safely refused.
4. **Partially satisfied:** Reproducible script/tests and real CI evidence exist; independent reviewer assessment and any final readiness/close decision remain pending.

**Recommendation:** keep PP-0007 `in_progress`, request an independent review of this candid benchmark methodology, then either implement operator-approved additional domain handlers/LLM integration and a controlled direct-assistant baseline or explicitly re-scope the task objective through an independently reviewed change. Do not mark verified, merge claims of broad readiness, or treat authenticated GitHub receipts as a direct-LM comparison.

Relevant details, commands and per-category table: `docs/PP0007-BENCHMARK.md`.
