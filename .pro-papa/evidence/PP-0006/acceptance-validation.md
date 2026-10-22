# PP-0006 acceptance and security validation

## Delivered executable host

- `bin/reference-host.mjs` is a real Node JSON-stdin program; `npm run reference-host` invokes it. `src/reference-host.mjs` binds a fixed tool set to the independently reviewed PP-0005 gateway. It does **not** intercept native ChatGPT Project messages.
- The host executes actual local `math.sum` and `text.metrics`. Host-approved read-only `research` calls fixed GitHub `GET /repos/OWNER/REPO` endpoints using a host-only repository allowlist. The public-GitHub live smoke succeeded in **real Actions run 39700311869**, job 119567665710, with `status:completed`, `provider:github`, a genuine repository ID and `https://github.com/Papa3445/Pro-Papa` output. This is provider-read evidence, not a fabricated test fixture.
- Optional `operations` creates a GitHub issue only when a trusted host has supplied **the exact approval UUID and repository**, GitHub token and separate durable project. All write tests used **mock HTTP** and intentionally did not create any real GitHub issue in a live repository.
- The host clones only JSON-plain request data via own descriptors, limits the encoded request size, and refuses accessors/stateful `toJSON`, nonfinite values and special prototypes before routing. Request JSON cannot grant tool access, set auditing, change credentials or choose arbitrary URLs.
- The host has process-local per-project serialization and uses gateway reservation/locks for durable requests. Same-id concurrent requests complete once; completed retries are deduplicated, externally ambiguous failures never rerun automatically. Cross-process filesystem races and provider atomicity are documented limitations.

## Fail-closed private audit contract

- When `--audit-required` is set, the reference host invokes the **actual** `issueUsageReceipt` PP-0004 function before any handler or durable reservation. It checks source blobs, private destination identity, authenticated PUT to a separate private repository, immutable commit-pinned byte-for-byte readback, and final private visibility. If the store/token is unavailable or a verification step fails, it returns `audit_failed` and does not dispatch work. No prompt, inputs or token is written to the receipt.
- Integrated Node tests exercise genuine PP-0004 function execution against deterministic GitHub API fixtures for successful issuance, unsafe public destination, failed PUT, corrupt readback, privacy races and absent token. Mocked remote requests are **not** actual production network calls.
- During this PP-0006 implementation, a separate authenticated **GitHub connector** completed a real provider-backed source read and private audit write/readback with final private visibility on `Papa3445/Pro-Papa-Audit`. This verifies current audit-repo access for the connected operator, but is **not** a live end-to-end reference-host CLI audit run using `GITHUB_TOKEN` in Actions, and must not be presented as such.
- Because private audit repository write credentials were **not** configured in CI for the executable host, a true production `--audit-required` CLI network smoke is still an integration-specific acceptance caveat. No stored test secret or public private-receipt body is included here.

## Real execution and evidence

- Final authenticated code+adapter+live-read run: https://github.com/Papa3445/Pro-Papa/actions/runs/39700311869
  - Check job `119567666047`: **136 passed, 0 failed, 0 skipped**, repository `valid:true` and 7 tracked tasks.
  - Live smoke job `119567665710`: actual GitHub repository HTTPS read through reference-host CLI, `status:completed`, plus authentic PP-0006 built-in `syntax:node` adapter execution. Provider-emitted adapter report committed to `.pro-papa/evidence/PP-0006/software-846ffc51-72bd-487c-abef-4b2e5ddeafe3.json` and source SHA-256 `641ac794ffec0ede0e488fc533690f0b6a0e1352f589548d0bb4afa0db1ee3b2`. Report SHA-256 `6182341cc5727817ea0cc21c827b69ad462c3a2982fcde68d59958745d697f42`.
  - `.pro-papa/evidence/PP-0006/github-actions-136-tests.json` binds observed run IDs and explicitly documents limitations.
- First 129-test run detected a real durable state misclassification: an uncertain **external write** failed but was marked `retryable` rather than `ambiguous`. `src/gateway.mjs` now marks only verified read-only failures `retryable`; potentially applied external effects remain ambiguous. The regression was rerun and passed.
- Subsequent negative test feedback resulted in permission-status fixture corrections and a missing-token `audit_failed` response instead of misleading `invalid_request`.

## Verification status

**Implementer validation only.** Real CI, live read-only GitHub provider output and genuine adapter were verified; a separate private connector receipt was verified. A completely live production host-audit invocation remains untested due to unavailable runner credentials. Independent code/security review of the actual current PR head is still required before any task closure or merge. No PP-0007 implementation work is included.
