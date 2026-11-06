# PP-0011 — Source-backed local outcomes and rollout limits

**Status:** incremental development evidence only. The canonical `.pro-papa/tasks.json` remains at revision 91 with PP-0011 **pending**. No production deployment or task closure is authorized by this report.

## Reproducible actual-host outcomes

Run `node bin/pp0011-local-acceptance.mjs` in a checked-out source revision (Node.js 22 or 26). The executable calls the real `createReferenceHost({dataProfileEnabled:true,traceMode:'enforced'})` and validates responses with `verifyReleasedExecution`. Its inputs are nonsensitive synthetic examples. It produces summaries only, with no raw prompts, generated source text, token handling, file writes, network requests or account changes. `tests/pp0011-local-acceptance.test.mjs` exercises both its in-process API and its real CLI.

| Domain | Actually executed handler | Validated result | Important limitations |
| --- | --- | --- | --- |
| Data | `data.profile` (trusted opt-in) | Numeric/missing counts, sum, mean, median, explicit privacy warning | Not anonymized; small samples can expose individuals |
| Document | `memo.draft` | Unverified draft contains two supplied facts and two actions | Formatting/inclusion only; no verified facts or human quality evaluation |
| Planning | `plan.week` | Three sequential weekday tasks and dependencies, two free days | No resource allocation or external calendar changes |
| Software | `code.iso-date` | Fixed source matches real parser; valid leap day accepted and invalid date rejected | Not open-ended coding or real application deployment |

**Negative tests:** without a host grant, read-only `research` and effectful `operations` requests return `denied` with `trace.state:not_released`. Invalid numeric data returns `provider_unavailable` without release; that is distinct from a permission denial. Repeating a valid stateless data request succeeds. This is **local recovery**, not proof of distributed replay, reversible external actions, or production rollback.

## Separately observed live sourced-research tool use

On 2026-11-06, a real read-only `research` call was made explicitly to the connected Pro-Papa Vercel staging MCP for public `Papa3445/Pro-Papa` repository metadata. The provider reported `status:completed`, `trace.state:released`, `execution.provenance.provider:github`, `operation:research`, source `repo:papa3445/pro-papa:1427703038`, public repository URL `https://github.com/Papa3445/Pro-Papa`, and `private:false`. The released execution SHA-256 was `228b03383a3cf7ada2eba83e7ced67de9d3fd07207272e1ac4c26e1c5d0c7169`; `callProvenance.method:tools/call` and response-only call ID `3b1ed311-7e59-4f20-965b-76a3e0ce0370` were reported. `providerAuthenticated:false` and `audit.status:not_requested` were also reported; this is **not** a private GitHub receipt, provider-authenticated persistence log or proof that an entire ChatGPT answer was routed through the tool.

An additional metadata attempt outside the staging host's anticipated allowed repository produced a tool error with `status:provider_unavailable` and a nonreleased trace. **This does not establish an explicit policy-denied response or proof of provider nonexecution.** Keep this observation distinct from the deterministic local default-denial check. Public GitHub issue/star counts are dynamic and were not frozen as quality baselines.

The staging execution is an externally observed single-tool result; it was **not executed by the standalone local smoke harness**, and this public summary does not contain private conversation text, credentials, raw requests, receipts or personal artifacts. Full provider request/readback correlation remains a future evidence requirement.

## Acceptance matrix and honestly unknown outcomes

| Gate | Observed | Not yet established |
| --- | --- | --- |
| Four local domains | Actual handler execution, mechanical output validation, fail-closed negative paths | Real user task-quality judgment or delivered artifact acceptance |
| Sourced research | One explicit staging GitHub metadata lookup with reported provenance | Comprehensive sourced investigation, independent source assessment and persistent provider log |
| Failure recovery | Safe stateless retry after invalid data | Recovery from uncertain externally applied writes or actual rollback |
| Permissions | Trusted host default-deny and separate opt-in, no authorized external write | Production-scoped permission policy and effects under live traffic |
| Owner acceptance | No new operator approval collected for these samples | Acceptance of the content, practical success, corrections and missing use cases |
| Comparative baseline | None in this increment | Paired direct-assistant results, latency/token overhead, statistical superiority or blinded scoring |
| Deployment/rollback | No deployment, connection changes or production smoke | Production rollback with actual provider readback and post-rollback health |

Record absent outcome quality, elapsed time, tokens and human corrections as `null` rather than filling in estimates. Original PP-0011 acceptance also requires an independent review on the exact future integrated evidence head.

## Safe rollout and rollback boundary

`data.profile` exists only in the standalone reference host and is disabled unless the trusted operator sets `dataProfileEnabled:true` or `--data-profile`. Request-supplied grants do not enable it. Reverting the local operator flag, restarting that host and confirming a new request is denied is the **proposed local opt-out**, not an executed production rollback. Do not represent a Git revert, build stop, or configuration screenshot as proof of successful rollback of deployed services.

For any future production rollout, separately authorize: the target host and route; live positive and negative cases; exact permission scope; actual source SHA and deployed readback; a tested rollback and health recovery; suitable privacy controls for sensitive observations; and independent user acceptance. PP-0013's credential-sensitive production tests require their own authorization. Do not modify Netlify/Vercel/Auth0 routing, billing, authentication, connectors, or deployment settings for this smoke.

## Review/closure requirements

Review the actual CLI/harness outputs and exact-head CI, and challenge the false-equivalence risks between local deterministic smoke, staging MCP result, native ChatGPT capabilities and user outcomes. This document does not alter the canonical task ledger, count simulated output as human acceptance, or authorize marking PP-0011 verified. A human quality decision and genuine provider-backed rollback/permission scope remain open.
