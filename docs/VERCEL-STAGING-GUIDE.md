# Vercel Hobby MCP: offline implementation and staged release gate

This is an **unreleased Vercel adapter candidate**. It does not change the live Netlify MCP, create a Vercel project, or configure ChatGPT. The [no-Netlify development plan](NO-NETLIFY-DEVELOPMENT-PLAN.md) is tracked in separate draft PR #63; the canonical framework ledger remains .pro-papa/tasks.json.

## Current staging configuration (Auth0 US-5 handoff)

The owner supplied screenshots showing **tenant `dev-tzvdy337r0wqo8r5`**, **region US-5**, **environment Development**. Auth0's documented public-cloud hostname format uses `<tenant>.us.auth0.com` for US subregions. The *candidate* canonical issuer is `https://dev-tzvdy337r0wqo8r5.us.auth0.com/`. The OIDC discovery endpoint / a real signed token's `iss` has **not** been successfully fetched yet, so do not claim live verification. Official references: https://support.auth0.com/center/s/article/Change-the-Tenant-Domain-Name and https://support.auth0.com/center/s/article/Subscribe-to-Atom-RSS-Feed-for-Status-Page-with-Multiple-Tenants-in-Different-Regions .

Vercel provider readback confirmed the dedicated `pro-papa-mcp-staging` Hobby project controls the **verified** `pro-papa-mcp-staging.vercel.app` domain. The following environment-variable **names** are saved as encrypted settings for the dedicated staging project (production, preview and development targets):

| Key | Staging value |
| --- | --- |
| PRO_PAPA_MCP_PUBLIC_HOSTNAME | `pro-papa-mcp-staging.vercel.app` |
| PRO_PAPA_MCP_RESOURCE | `https://pro-papa-mcp-staging.vercel.app` |
| PRO_PAPA_AUTH0_ISSUER | `https://dev-tzvdy337r0wqo8r5.us.auth0.com/` (candidate pending OIDC/issuer check) |
| PRO_PAPA_MCP_ARTIFACT_VALIDATION | `false` |

A preview deployment's random hostname **will not match** that configured canonical hostname; it must fail closed, rather than disable host/audience checks. For remote testing, use the **stable domain on this dedicated staging project**, not a preview alias or the existing Netlify production domain. No deployment or connector cutover has occurred.

### Required Auth0 API registration (manual, no credential sharing)

The existing Auth0 tenant's **Default Audience is blank** in the screenshot; **leave it blank**. Do not edit or replace the existing Netlify API, because its current audience may be used by the live MCP connection.

1. In Auth0 Dashboard → Applications → APIs, see whether an API with identifier **exactly** `https://pro-papa-mcp-staging.vercel.app` already exists.
2. If not, create a *separate* API: name **Pro-Papa MCP Staging**, identifier/audience **`https://pro-papa-mcp-staging.vercel.app`** (no trailing slash), signing algorithm **RS256**. The API identifier is immutable after creation; verify spelling before saving.
3. Under that API's **Permissions**, add scope **`pro_papa.read`**. Grant this scope to the intended test identity/client following Auth0's least-privilege authorization flow; do not claim authorization from a user-entered label alone.
4. Verify the actual tenant-issued discovery document and access token claims against the configured issuer, audience, expiry and scope before enabling staging access. Do not paste JWTs, OAuth client secrets, API tokens or signing keys into GitHub or chat.
5. The staging endpoint must also prove correct RFC 9728 static metadata, authenticated MCP calls and distributed abuse controls. Free-provider compatibility has been demonstrated only by offline tests so far.

Auth0 API setup guidance: https://auth0.com/docs/quickstart/backend/golang/interactive and https://developer.auth0.com/resources/code-samples/api/express/basic-role-based-access-control/typescript .

## Files and boundaries

- api/mcp.mjs: Vercel Node.js Web Standard fetch handler calling the unchanged src/mcp-web.mjs and src/oauth-resource.mjs under the existing read-only capability allowlist. It requires exact issuer, hostname and resource environment configuration, with invalid configuration returning HTTP 503.
- vercel.json: /mcp -> /api/mcp rewrite, plus JSON metadata response headers.
- bin/render-vercel-oauth-metadata.mjs: build-time generation of public/.well-known/oauth-protected-resource from the same issuer/resource. Vercel reserves /.well-known against rewrites, so this path must be served as a **static file**. That static-path behavior is a **live staging validation requirement**, not a verified hosting result.
- tests/vercel-mcp.test.mjs: offline configuration, static metadata, denial and signed JWT/JWKS execution checks.

## Prerequisites (before any staging deploy)

1. Verify in the actual connected Vercel account that its plan is Hobby ($0), is for personal/noncommercial use, and has remaining free included usage. A plugin installation alone is not account-plan verification. Do not activate Pro, a trial, purchased domains, metered add-ons, or paid overages.
2. Establish a Vercel project / staging hostname separately and authorize its deployment. **Do not use Netlify** or merge to the protected main branch. Vercel Git integration may create preview deployments from branches; require explicit approval before linking this repository.
3. Provision host-managed environment variables: PRO_PAPA_MCP_PUBLIC_HOSTNAME = exact staging hostname (without scheme), PRO_PAPA_MCP_RESOURCE = https://same-hostname, PRO_PAPA_AUTH0_ISSUER = exact already-approved Auth0 issuer ending in slash, PRO_PAPA_MCP_ARTIFACT_VALIDATION = false unless deliberately enabled. Configure the correct audience and redirect allowlists in Auth0. No token or secret is stored in source.
4. In the staging build ensure node bin/render-vercel-oauth-metadata.mjs runs; missing or invalid env values must fail the build. Never publish a placeholder metadata document.
5. Verify **from the actual public URL**: GET /.well-known/oauth-protected-resource returns HTTP 200 and application/json with exact resource, authorization_servers and scopes; POST /mcp allows initialize and tools/list as specified, rejects invalid JWT and scope, accepts a genuine correctly scoped test identity, and returns a released trace for math.sum. A successful local test alone does not prove any of this.
6. Evaluate parity with existing Netlify per-IP rate limiting (30/min) or document and provision a distinct abuse-control mechanism before accepting production security parity; warm-host concurrency checks are not distributed rate limits.
7. Confirm the Vercel Hobby cap and actual usage after tests; note Vercel may pause the app when free quota is exhausted.
8. Get exact-head CI and independent review. A successful staging smoke does not authorize changing ChatGPT connector configuration or shutting off Netlify. Obtain distinct release approval.

## What can be verified without hosting

Run npm test (includes tests/vercel-mcp.test.mjs), node bin/pro-papa.mjs validate --root ., and review vercel.json. These checks are provider simulation and code checks, **not** a live Vercel deployment, billing verification or Auth0 integration.

Relevant docs: https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/docs/plans/hobby ; https://vercel.com/docs/routing/rewrites ; https://www.rfc-editor.org/rfc/rfc9728.html .
