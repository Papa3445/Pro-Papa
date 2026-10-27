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
