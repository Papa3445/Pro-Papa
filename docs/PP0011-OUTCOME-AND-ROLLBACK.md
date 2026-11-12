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
| Owner acceptance | Actual reference-host outputs have not been operator-graded in this harness; any feedback on separately presented examples is outside this public source | Acceptance of the reference-host content, practical success, corrections and missing use cases |
| Comparative baseline | None in this increment | Paired direct-assistant results, latency/token overhead, statistical superiority or blinded scoring |
| Deployment/rollback | Fresh-process local host opt-out/re-enablement exercised in regression (no external effects) | Production rollback with actual provider readback, in-flight effects and post-rollback health |

Record absent outcome quality, elapsed time, tokens and human corrections as `null` rather than filling in estimates. Original PP-0011 acceptance also requires an independent review on the exact future integrated evidence head.

## Safe rollout and rollback boundary

`data.profile` exists only in the standalone reference host and is disabled unless the trusted operator sets `dataProfileEnabled:true` or `--data-profile`. Request-supplied grants do not enable it. The regression `tests/pp0011-local-acceptance.test.mjs` now **executes a local opt-out** in four separate standalone CLI processes: (1) trusted `--data-profile` allows the sample computation; (2) starting a new process without the flag returns `denied` / `host_permission_required` with no released execution; (3) forged request-supplied grant fields cannot restore access; (4) a newly explicitly enabled host allows the sample again. The test uses `--enforce-trace`, suppresses external credentials and requires an empty stderr. This proves only per-process trusted flag opt-out and reenablement, **not** cancellation of in-flight work, distributed service rollback, production route changes or external provider readback. Do not represent a Git revert, build stop, or configuration screenshot as proof of successful rollback of deployed services.

For any future production rollout, separately authorize: the target host and route; live positive and negative cases; exact permission scope; actual source SHA and deployed readback; a tested rollback and health recovery; suitable privacy controls for sensitive observations; and independent user acceptance. PP-0013's credential-sensitive production tests require their own authorization. Do not modify Netlify/Vercel/Auth0 routing, billing, authentication, connectors, or deployment settings for this smoke.

## Review/closure requirements

Review the actual CLI/harness outputs and exact-head CI, and challenge the false-equivalence risks between local deterministic smoke, staging MCP result, native ChatGPT capabilities and user outcomes. This document does not alter the canonical task ledger, count simulated output as human acceptance, or authorize marking PP-0011 verified. A human quality decision and genuine provider-backed rollback/permission scope remain open.

**Operator-feedback privacy boundary:** Limited subjective acceptance of separately presented chat examples, if recorded, belongs in a private operator-controlled evidence record. It is not automatically acceptance of the reference host's `memo.draft` or `plan.week` output. This public repository contains no conversation text, operator identity, or raw chat artifacts, and PP-0011 remains pending.

## Reproducible review of *actual* reference-host artifacts

A separate source-backed quality fixture, `node bin/pp0011-real-host-operator-samples.mjs`, invokes the genuine `bin/reference-host.mjs --enforce-trace` in four independent local subprocesses, with `--data-profile` only for the nonsensitive numeric case. It captures **actual host-release-validated output**, not a manually copied illustration of individual source modules. It uses synthetic inputs with an allowlisted minimal process environment, no credentials, audit-disabled ephemeral execution, no network or external writes. A companion test executes this script, validates content and trace hashes, bounds JSON output, and prints a single marker `PP0011_ACTUAL_HOST_OPERATOR_SAMPLES` in trusted exact-head CI logs for review.

These artifacts are for **a new, separate operator decision**: the prior private acceptance of four *source-module examples shown in chat* does not grant approval of any output from the full reference-host gateway. The local trace is host-verifiable but not cryptographic provider attestation. For the sample memo, supplied facts remain unverified and document content is not an actual native ChatGPT document; for the weekly plan, tasks are sequential drafts rather than calendar events; numeric summaries are not anonymized; and code is a fixed date parser, not open-ended code generation.

Do not infer genuine live provider research, production rollback, external effects, distributed in-flight revocation, statistical superiority, or full PP-0011 closure from this fixture. Reviewers should inspect the **exact-head GitHub Actions job log** with the sample marker and have the user assess the displayed real-host artifacts separately. The sample only becomes meaningful after the exact CI run and owner quality assessment are recorded; no owner acceptance is prefilled in the fixture.

## Bounded issue-level sourced research candidate (PP-0011)

The standalone reference host can now request an explicitly allowlisted GitHub issue by positive integer ID through the separately typed, read-only `research.issue` capability when the **trusted host** has enabled `--github-read --github-repo OWNER/REPO`. It issues only a fixed-URL `GET /repos/OWNER/REPO/issues/NUMBER`, returns the issue identity/URL/state/updated time and a bounded **untrusted** text excerpt, rejects pull requests masquerading as issues or mismatched provider URLs, and does not accept request-supplied permission grants. Synthetic positive and denial tests are the first development increment; **a CI test double is not a live authorized provider readback, semantic synthesis or operator-accepted research answer**. The real Vercel staging MCP is unchanged by this local-host source addition. Future live provider verification and domain-quality review remain separate requirements. This adds no external writes, deployment settings, new credential scope, or production permission. PP-0011 stays pending.

## Nondeploying live issue research acceptance probe

`node bin/pp0011-live-issue-smoke.mjs` uses the **real** standalone `bin/reference-host.mjs` to request a single public `Papa3445/Pro-Papa` issue #37 via the trusted host's repository allowlist and opt-in `--github-read`. Its subprocess has an explicit minimal environment with **no GitHub token, audit credentials, inherited secret or writable service capability**. It first exercises two host-level negatives without a provider GET, then attempts one real GitHub GET and verifies the released host execution trace. A failed/unavailable provider response fails the probe; neither a synthetic fixture nor a passing standard CI check substitutes for a completed live read.

`.github/workflows/pp0011-live-issue-smoke.yml` performs this read only on the single named development branch (or an explicit manual dispatch), with `contents: read` and no secrets, deployment, workflow write, status write, or production permissions. It is separate from the normal deterministic `check` workflow to avoid converting routine CI into a permanent public-network-dependent integration test. Inspect the **real** Actions `PP0011_LIVE_ISSUE_RESEARCH` marker to evaluate output, source and trace; otherwise report it as unverified. This probe is nondeploying, does not establish that the Vercel staging MCP is updated, and does not establish human quality acceptance, statistical superiority, actual deployed production permissions or rollback. PP-0011 remains pending.
