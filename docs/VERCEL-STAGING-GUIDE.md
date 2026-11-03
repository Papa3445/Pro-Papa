# Vercel Hobby MCP: offline implementation and staged release gate

This is an **unreleased ChatGPT connector migration candidate**. An isolated Vercel Hobby project and build now exist, but the new MCP has **not** been authenticated end-to-end or selected as the active ChatGPT connection; Netlify remains unchanged. The [no-Netlify development plan](NO-NETLIFY-DEVELOPMENT-PLAN.md) is tracked in separate draft PR #63; the canonical framework ledger remains .pro-papa/tasks.json.

## Authorized Vercel Authentication change and public staging smoke — 2026-11-02

The owner **explicitly authorized** disabling Vercel Authentication **only** for the dedicated `pro-papa-mcp-staging` project. A scoped Vercel project PATCH updated `ssoProtection:null`; provider readback verified `ssoProtection.enabled=false`. No other project, Auth0 tenant setting, Netlify deployment, paid plan, source-branch merge or ChatGPT connector was changed. The MCP's Auth0 JWT validation is still enforced in server code for `tools/call`.

GitHub workflow [Vercel staging public OAuth and negative MCP smoke, run 41573245408](https://github.com/Papa3445/Pro-Papa/actions/runs/41573245408) is a **real, credential-free HTTPS check**, triggered from review-branch SHA `1bcb14ae81dfe7cecc3e5c9fc105b50a8d10270a`. It independently verifies:

1. Auth0 OIDC discovery HTTP 200 with the **exact** `https://dev-tzvdy337r0wqo8r5.us.auth0.com/` issuer and a reachable public JWKS HTTP 200 containing an RSA signing key.
2. `GET https://pro-papa-mcp-staging.vercel.app/.well-known/oauth-protected-resource` returns HTTP 200 with exact resource, Auth0 server and `pro_papa.read`.
3. `GET /mcp` returns HTTP 405; stateless JSON-RPC `initialize` and `tools/list` return expected structures.
4. Two `tools/call` attempts without a bearer or with a malformed bearer return **denials**, without tool output.
5. A foreign `Origin` returns HTTP 403.

**Result: 9/9 passed.** No token, user input, client secret or authenticated account credential was sent. The workflow and its runner output are independent of Vercel's deployment `READY` indicator. Source SHA `c2f21f91d239fcf7ed0edfaa574706c2ec2fbf80` is the deployed *server*; the later review-branch commit contains public test code only. This is not a source-code redeployment.

**Still unverified:** real correctly scoped signed Auth0 JWT acceptance, ChatGPT OAuth client registration/consent and reconnection, tenant-wide Resource Parameter Compatibility Profile and DCR configuration, distributed production-grade rate limiting, exact spending total, and independent release approval. Keep the staging project separate and the live Netlify MCP connection unchanged.

**Next external action:** ask the owner to inspect Auth0 Dashboard → Settings → Advanced → **Resource Parameter Compatibility Profile** and **Dynamic Client Registration** settings. Auth0 documents that MCP clients send the RFC 8707 `resource` parameter; without compatibility support, an audience mismatch can occur. These are **tenant-wide** settings affecting other applications; do not modify on the user's behalf without a distinct authorization. Official evidence: https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0 .

## Current staging configuration (Auth0 US-5 handoff)

The owner supplied screenshots showing **tenant `dev-tzvdy337r0wqo8r5`**, **region US-5**, **environment Development**. Auth0's documented public-cloud hostname format uses `<tenant>.us.auth0.com` for US subregions. The *candidate* canonical issuer is `https://dev-tzvdy337r0wqo8r5.us.auth0.com/`. The real OIDC discovery endpoint was subsequently verified by credential-free GitHub Actions (see the newer evidence above), but **no signed access token's `iss` has been inspected**. Official references: https://support.auth0.com/center/s/article/Change-the-Tenant-Domain-Name and https://support.auth0.com/center/s/article/Subscribe-to-Atom-RSS-Feed-for-Status-Page-with-Multiple-Tenants-in-Different-Regions .

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

## Staging deployment and remaining security gates — 2026-11-02

**Verified source and provider facts**

- Owner said a separate Auth0 API with identifier `https://pro-papa-mcp-staging.vercel.app` was created and that scope `pro_papa.read` was added. This is **user confirmation**, not a Management API readback or a proven client grant / token scope.
- Vercel team has plan **Hobby**. The dedicated project `pro-papa-mcp-staging` owns the verified domain `pro-papa-mcp-staging.vercel.app`; encrypted staging configuration is present. The provider reports **no linked Git projects**, preventing automatic Vercel builds on source pushes.
- The first attempt to deploy the pinned GitHub PR #64 source by `gitSource` failed with `git_info_fail` because the project has no linked Git integration. It generated **no ready service**.
- A second deployment directly uploaded the code and recursive local-module dependency graph from GitHub commit `c2f21f91d239fcf7ed0edfaa574706c2ec2fbf80`, plus the exact static OAuth protected-resource metadata. The provider reports `READY`, deployment ID `dpl_y6WTePYdcAynSsDw1ozGPnUjQsQA`, target `production` **inside the separately named staging project**, and stable canonical domain alias `https://pro-papa-mcp-staging.vercel.app`. No Netlify deployment, main merge or ChatGPT connector switch happened.
- The provider build log reports a completed Lambda build. Provider file listing shows an output `api/mcp` Lambda and includes source `public/.well-known/oauth-protected-resource`; **HTTP GET of the static metadata and POST to MCP have NOT been confirmed**. Do not infer correct static routing merely from source files or `READY` state.
- Historically, the staging project had Vercel Authentication enabled and the deployment-inspection tools could not fetch the URL. With explicit user authorization Vercel Authentication was disabled **for this staging project only**. Independent GitHub Actions then verified real public HTTPS metadata and negative MCP behavior. Authenticated JWT and client-connection checks remain pending.
- Billing status beyond the Hobby plan has not been proved: the charges report returned `404 costs_not_found`. Do not claim a precise $0 charge total; the Hobby account and free tier are confirmed.
- Existing exact-head PR #64 GitHub Actions checks passed for the deployed source SHA; no independent production approval or runtime proof has been supplied.

**Auth0 integration still required**

1. Verify actual tenant issuer via a trusted OIDC discovery request or signed token `iss`. The inferred US-5 issuer is not live-confirmed; failed external discovery attempts are not proof that the domain is wrong.
2. Confirm the staging API is separately registered with RS256, scope `pro_papa.read`, and an appropriate application/client grant and authorized test identity. An API scope alone does **not** grant application access.
3. Auth0 documents a potential MCP-specific `resource` vs `audience` mismatch. For third-party clients it may be necessary to enable **Settings → Advanced → Resource Parameter Compatibility Profile**; this is a tenant-wide security setting, so inspect existing behavior and obtain explicit user approval before changing it. Official note: https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0 .
4. To allow ChatGPT to discover/use the staging endpoint, resolve Vercel's protection policy for **this staging project only**, preserving the existing JWT/OAuth gates and rate limits. Confirm whether the owner's plan can allow that route without any paid add-on.
5. Test the real public URL: RFC 9728 metadata status and headers, deny requests with no/invalid JWT, accept authorized RS256 audience/scope token, `initialize`, `tools/list`, `tools/call`, released trace, and bounded abuse behavior. Never paste tokens into chat or source.
6. Only after successful staging smoke, exact-commit review and separate approval, change the ChatGPT connection. Leave Netlify active and untouched until the new connection has been verified.

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

Run npm test (includes tests/vercel-mcp.test.mjs), node bin/pro-papa.mjs validate --root ., and review vercel.json. These checks are provider simulation and code checks **in isolation**; the distinct live public staging smoke evidence appears above. Neither check is proof of authorized Auth0 token issuance or a ChatGPT connector cutover.

Relevant docs: https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/docs/plans/hobby ; https://vercel.com/docs/routing/rewrites ; https://www.rfc-editor.org/rfc/rfc9728.html .
