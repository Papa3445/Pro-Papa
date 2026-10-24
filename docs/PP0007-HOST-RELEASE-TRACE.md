# PP-0007 — host-enforced response release trace (opt-in)

**Scope:** This implementation applies **only to explicit invocations of the Pro-Papa Node reference host**. It is not an OpenAI/ChatGPT Project hook, not a recording of hidden model reasoning, and not an independent attestation of provider actions. It does not edit the frozen `PP-0007-UI-PROSPECTIVE-V2` 21-pair/42-observation study or retrofit previous screenshots.

## Launch a local host with a release gate

Node.js 20+, from a trusted checkout. For a local deterministic math request, no GitHub token or audit is required:

```sh
printf '%s\n' '{"objective":"Sum verified numbers","capability":"math.sum","inputs":{"numbers":[2,3,5]}}' |
  node bin/reference-host.mjs --enforce-trace
```

The returned `status:"completed"` is released only when the request was accepted, routing selected a configured capability, **exactly one** wrapped handler was invoked and returned, `runGateway` accepted the handler's structured output/provenance, and the trusted host validated the trace against the actual output and selected capability. The result includes `trace.state:"released"`, monotonically numbered event names, the selected route, provider label, and SHA-256 of the **checked execution object**. The trace is host-local evidence; the local hash is **not a digital signature**, and self-reported GitHub claims are insufficient.

To require a genuine private GitHub usage receipt *before* task dispatch, a separately configured Node host may use both flags with host-managed credentials:

```sh
PRO_PAPA_AUDIT_REPO=AUTHORIZED_PRIVATE_STORE GITHUB_TOKEN=HOST_MANAGED_SECRET \
  node bin/reference-host.mjs --enforce-trace --audit-required --github-read \
    --github-repo Papa3445/Pro-Papa
```

Send a valid JSON request through standard input. Do **not** paste credentials or sensitive user text into CLI arguments or source code. In required-audit mode the trace requires a real PP-0004 private-store read/write/readback confirmation *before* routing. The existing simulated audit transport remains rejected; an operator-written JSON receipt or request-provided `trace`, `auditMode`, or `grants` cannot alter trusted host controls.

## Exact outcome semantics

- `released` requires ordered `request.accepted → audit.confirmed` (or `audit.not_required`) `→ route.selected → handler.started → handler.returned → output.validated → response.released`. The host checks the release decision before returning a successful response. It never records a handler invocation merely because a receipt exists.
- Denied grants, unsupported routes, provider errors, simulated/missing audits, replayed durable requests, or missing/invalid handler evidence return `trace.state:"not_released"` with `execution:null`; they cannot be counted as fresh successful outcomes. Existing error statuses remain meaningful; an anomalous apparent success that fails the trace gate becomes `execution_gate_failed`.
- **CLI release/exit rule:** with `--enforce-trace`, exit code **0** requires both `status:"completed"` and a locally verified `trace.state:"released"`. Durable `already_executed` returns `trace.state:"not_released"` and exit **1** (not another completed trial). Without trace enforcement, the existing CLI replay success status is preserved. If `--audit-required` is set but the audit store variable is absent, CLI exits **1**, preserves `status:"audit_failed"`, and emits a blocked trace with `audit.failed`. Malformed traced CLI input similarly emits a `request.rejected` blocked trace without leaking the input. A blocked CLI trace signals non-release only; it does not prove any execution was attempted.
- All event steps arise in trusted host code rather than request fields. `verifyReleasedExecution()` recomputes the output digest and checks ordering and matching route/provider. It detects post-processing mistakes and payload modifications **within this trust model**; anyone controlling host code or a mutable output/trace pair can fabricate a local trace.
- The trace deliberately excludes objectives, canonical inputs, private response text, tokens, credentials, and identifiers tying it to a ChatGPT account. `trace.providerAuthenticated:false` is explicit. The audited receipt is still a separate GitHub record, not a proof of the model's internal reasoning or conversation/receipt mapping.
- The gateway handles only its bounded supported capabilities. It does **not** natively answer arbitrary freeform questions as a model, intercept conversations on chatgpt.com, or control the UI's rendered response. Making a ChatGPT Project use this host on every message requires a separately supported host/product integration with release authority; do not claim one exists from these tests.
- Traces are returned to the immediate caller; this patch does not create durable trace persistence, trusted signing, calibrated wall-clock timing or independent quality grades. The PP-0007 benchmark and milestone remain open pending real observations and independent review.

**Independent review:** the initial PR #22 reviewer found two CLI-specific gaps at commit `ea0e8549215ac17ef0d86c1a35fbd878fd24ffcd` (P2-1 missing-audit trace, P2-2 durable replay exit code). The regression fix includes real child-process tests and retains the rejection record. No re-approval is implied by these changes.

## Verification

`npm run check` performs static syntax validation and the repository's automated test suite, including regression cases for mocked audits, unauthorized grants, research handler calls through an injected test provider, rejected outputs, duplicate replay, changed output hashes, and false event ordering. These tests show actual Node behavior in CI, **not** external GitHub fetches when transport is simulated. A real private-store receipt requires a separate provider-backed operation in the configured host.

All code changes must pass exact-head CI and receive independent approval before merge. This is a PP-0007 supporting increment, not a re-opened PP-0006 and not PP-0007 closeout.
