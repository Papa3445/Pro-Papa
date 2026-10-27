# PP-0007: production no-credential smoke

This is a **bounded, non-privileged** three-request HTTPS test of the already deployed
`https://pro-papa-mcp.netlify.app` Netlify MCP site. It does not change production
settings, execute an authenticated tool or require secrets. It is triggered once on
pushes to the dedicated `verification/pp0007-production-smoke` branch, or explicitly
from GitHub Actions `workflow_dispatch` after the workflow lands on `main`.

```
node bin/pp0007-production-smoke.mjs --live
```

The test uses HTTPS only, a fixed hostname, no redirects, eight-second per-request
timeouts and response-size limits. It GETs public OAuth protected-resource metadata,
then POSTs read-only MCP `tools/call` JSON-RPC messages without authorization and with
an explicitly invalid Bearer string. Each response must be an OAuth-aware **denial**
with no released `structuredContent` and a properly scoped challenge. No private
issuer hostname, JWT, response payload or credentials are logged. Failures are real
observations, not permission to loosen the service's authentication.

**Interpretation:** Passing means public OAuth metadata and two unauthenticated tool
calls behaved as expected **from the GitHub runner at that moment**. It does not
validate an actual signed access token, JWT expiration/audience/scope/rotation,
Auth0 identity provisioning, warm-instance behavior under load, worldwide quota,
ChatGPT turn interception, or the original seven-category comparative benchmark.
Those require separate genuinely authorized tests and independent evaluation. Netlify
published deploy SHA must be read through the Netlify provider and matched to the
reviewed GitHub `main` SHA. A GitHub Actions pass alone does not pin the runtime SHA.

Do not store access tokens, private artifacts or individual requests in public issue
comments. Evidence should include the exact smoke run ID, public summary and actual
published deploy SHA. This tool's mocked Node tests verify fail-closed behavior but
**do not constitute live network smoke**.

## Opt-in, real signed-JWT production verification

After a separate explicit security/operator authorization, configure **GitHub Environment `production-smoke`** with required reviewer protection and *environment secrets* `PRO_PAPA_SMOKE_CLIENT_ID`, `PRO_PAPA_SMOKE_CLIENT_SECRET`, and `PRO_PAPA_SMOKE_EXPECTED_ISSUER` (exact independently verified production Auth0 issuer, including trailing slash). Use a least-privilege, dedicated noninteractive Auth0 M2M client granted **only `pro_papa.read`** on the canonical `https://pro-papa-mcp.netlify.app` API. Never store credentials in public issues, repository files, PR body, logs, or artifacts.

Once this code is independently reviewed and **separately authorized to merge**, go to GitHub Actions → **PP-0007 signed JWT production verification (manual only)** → Run workflow on protected `main`. The workflow **never runs on PRs or pushes**. It refuses running on other branches. Environment approval and genuine M2M credentials are prerequisites, not assumed existing.

The script checks public metadata's Auth0 issuer matches the **out-of-band pinned secret** before transmitting client credentials; obtains one short-lived M2M token over HTTPS; calls bounded read-only `math.sum(3,4)` and verifies the released result 7; then modifies the token signature and requires strict denial with no structuredContent. HTTPS redirects are refused; response bodies are size bounded; network calls time out. No secrets or issuer/token URLs are printed by the CLI; only non-sensitive pass/fail labels are returned. Test requires **four** HTTPS requests (metadata, Auth0 token endpoint, one valid and one tampered MCP call).

Unit tests are synthetic and cannot substitute for a **real authorized production run**. A passing live run proves only an M2M happy path and a tampered signature denial, NOT expiration, incorrect scope/audience, JWKS rotation, user-delegated login, global concurrency, broader benchmark, or ChatGPT turn attribution. Keep PP-0007 open until its genuine acceptance and reviewer pinning are completed.
