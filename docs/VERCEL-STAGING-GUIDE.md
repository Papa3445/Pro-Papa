# Vercel Hobby MCP: offline implementation and staged release gate

This is an **unreleased source merge / production cutover candidate**. The isolated Vercel Hobby project hosts a functioning Auth0-connected ChatGPT staging MCP plugin. The owner has not approved retiring the older Netlify connection, and the PR remains unmerged. The [no-Netlify development plan](NO-NETLIFY-DEVELOPMENT-PLAN.md) is tracked in separate draft PR #63; the canonical framework ledger remains .pro-papa/tasks.json.

## Deployment source attestation and next release gates — updated 2026-11-03

The [reproducible staging source and rollback runbook](VERCEL-STAGING-RELEASE-RUNBOOK.md) records provider-backed SHA-1 content-UID matches for **17/17** uploaded source files at pinned deployed Git commit `c2f21f91...`, plus the complete generated OAuth metadata file (**18/18** source entries accounted for). The original provider source readback was truncated for larger files; UID matches establish source-content consistency, **not compiled Lambda byte attestation**. The runbook also includes a checked, allowlisted, deterministic source exporter with SHA-256 manifest and offline tests. GitHub CI checks Node.js **22 and 26** (Vercel runtime 26.x). No new deployment has occurred.

**Still outstanding:** a separately approved staged deployment at a pinned PR commit; provider validation of the candidate's complete source-file manifest; an actual safe rollback to the previous READY build and health verification; independent updated security review and separate merge approval. The prior WAF and Auth0 steps need not be repeated without new evidence of a defect. The original ChatGPT/Netlify connection remains unchanged.

## Active staging WAF rate limiting — verified 2026-11-03

The owner expressly approved **staging-only** Vercel WAF rate limiting. The account and project were reverified on the **Hobby** plan; no upgrade or billing change was made. After `GET active` initially returned 404 (no custom configuration), a narrowly scoped `rules.insert` created Vercel firewall version **1**, ID `waf_A0nbRDUqSbhL`, with one **active, valid** custom rule:

- Rule ID: `rule_pro_papa_staging_mcp_30_req_min_per_ip_rgoUIi`
- If **request path is any of** `/mcp` or `/api/mcp` (one shared rule)
- Then **rate_limit**, **fixed_window**, **30 requests / 60 seconds**, keyed by **IP**, exceeded action **rate_limit / HTTP 429**.
- Scoped exclusively to project `prj_QOcJEubys5o8pdlyC30I0E7uuzK0` (`pro-papa-mcp-staging`), team `team_vEgIRliWXQMyHAWaZp59je14`. No other Vercel project was modified.

Provider `get_firewall_config(configVersion="active")` readback confirmed **firewallEnabled=true**, the above condition/action, `active=true`, `valid=true`, and **zero pending changes**. The actual credential-free external GitHub Actions [44-request HTTPS smoke](https://github.com/Papa3445/Pro-Papa/actions/runs/41714465828) passed: 15 ordinary HTTP 405 responses and 7 HTTP 429 responses **on each route**, totaling **30 ordinary + 14 limited** across the shared IP allowance. A real Auth0-connected `Pro-Papa Vercel Staging` MCP `math.sum(2,3,5)` call still returned 10 with `completed` / released trace **after** activating WAF.

**Scope and limitations:** This is live WAF enforcement, not just an offline simulation. Counters can be regional, so a source reaching different WAF regions may exceed the nominal limit globally. The rule is provider-side state: source-code merges and function deployments do not reproduce it automatically. The Hobby free tier documents one rule per project and first 1 million allowed rate-limit requests included; exceeding free allocations can pause the project. See https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting and https://vercel.com/docs/plans/hobby .

This evidence addresses the independent review's **unverified distributed edge rate-limit** blocker within the stated per-region design; independent review of the exact current configuration is still required. **Deployment reproducibility, complete runtime artifact attestation, safe rollback and independent release approval remain open.** No Netlify call, Auth0 setting, main-branch merge, ChatGPT connection change, Vercel deployment or paid-tier upgrade occurred in this WAF change.

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

## Auth0 registration settings (user screenshots, 2026-11-02)

The owner's Auth0 Tenant Settings → Advanced screenshots show **Resource Parameter Compatibility Profile = ON**, **Dynamic Client Registration (DCR) = OFF**, **Client ID Metadata Document (CIMD) Registration = OFF**, and **Dynamic CIMD Registration = OFF**. These are user-visible UI observations, not authenticated Auth0 Management API readback. The other flags and global legacy client ID are unrelated and must not be copied into GitHub.

**Preferred next approach: predefined OAuth client (DCR can remain OFF).** OpenAI's current [OAuth plugin specification](https://developers.openai.com/plugins/build/auth) explicitly supports **predefined/registered clients**, CIMD and DCR. Use ChatGPT Plugins → Add custom MCP server, configure a separate connection for `https://pro-papa-mcp-staging.vercel.app/mcp`, select a registered/predefined OAuth client where the builder offers it, and copy the **actual redirect callback URL** from that builder. In Auth0 Applications → Applications, create a **dedicated staging OAuth client** with the appropriate redirect allowlist, authorization-code + PKCE and least-privileged `pro_papa.read` audience/scope grants. Use a public client with `none` where supported or a confidential client with a host-managed secret entered **only into the ChatGPT plugin configuration UI**; never paste secrets into chat or GitHub. Do not reuse the tenant's *Global Client ID* from the legacy-client section.

**If the actual ChatGPT builder cannot use a predefined client**, pause and seek authorization before enabling DCR. Auth0 [warns](https://support.auth0.com/center/s/article/Dynamic-Client-Registration) that DCR enables anonymous, token-free client registration in the tenant, which can lead to unapproved registrations; if selected, first evaluate Auth0's [DCR ACL controls](https://auth0.com/changelog?version=v202545) and strict registration mode. DCR itself does not authorize `tools/call` without a valid audience-/scope-bound JWT. CIMD is a potentially safer registration route, but actual Auth0 tenant support, plan eligibility and ChatGPT metadata compatibility must be confirmed before enabling any early-access flag.

Do **not** change Default Audience or legacy Netlify API settings. No tenant-wide Auth0 flag was toggled during these observations. The deployed staging build still has 9 credential-free public checks passing; the next *unverified* gate is a real user-approved OAuth exchange and scoped tool execution. Preserve the old ChatGPT plugin connection until the new one passes and the owner approves cutover.

## ChatGPT plugin creation: Auth0 user-delegated access blocker (2026-11-02)

The owner created a distinct `Pro-Papa Vercel Staging` ChatGPT custom MCP plugin using a **user-defined public OAuth client** with the new Auth0 Single Page Web Application `Pro-Papa ChatGPT Staging` and a matching ChatGPT callback URL. The plugin was created but authorization returned:

> OAuth failed: `invalid_request` — Client is not authorized to access resource server `https://pro-papa-mcp-staging.vercel.app`.

**Meaning:** Auth0 did not authorize this specific application's **user-delegated** API access. This error occurs at the authorization server before a valid bearer token can reach the deployed MCP server; it is **not** evidence of a Vercel build, JWT verification or callback-routing failure. No tenant-wide Auth0 switches or Netlify changes are needed to fix it.

**Exact owner action:**

1. In Auth0 Dashboard, open **Applications → Applications → Pro-Papa ChatGPT Staging → API Access**.
2. Find **Pro-Papa MCP Staging** (`https://pro-papa-mcp-staging.vercel.app`), choose **Edit**.
3. Under **User-Delegated Access**, choose **Authorized** with the specific permission **`pro_papa.read`** only, then **Save**. Leave **Client Access / machine-to-machine** unauthorized. An equivalent route is **Applications → APIs → Pro-Papa MCP Staging → Application Access → Edit**. If a grant cannot be configured, inspect this API's Settings → Application Access Policy for user-delegated access; prefer **Allow via client-grant** plus a scoped per-app grant, not a broad allow-all or disabled authorization.
4. Retry the new ChatGPT plugin's OAuth sign-in and verify a real signed access token with correct issuer, audience and scope is used for a `tools/call` request. Do not treat a successful OAuth redirect alone as a full MCP smoke test.

Auth0 docs: https://auth0.com/blog/developers-guide-api-access-policies-auth0/ ; https://support.auth0.com/center/s/article/Error-Client-is-not-authorized-to-access-API .

No Auth0 Management API mutation, client grant, new Vercel build, original-plugin replacement or Netlify change was performed as part of this diagnosis. The client grant and positive authenticated tool execution remain **pending owner action and observed evidence**.

## ChatGPT registered-client UI observed (owner screenshots)

In ChatGPT Plugins → Add custom MCP server → Advanced OAuth settings, the live connector builder showed:

- **Registration method: User-Defined OAuth Client**. This is a manual/pre-registered OAuth client, so DCR and CIMD can stay disabled. The DCR/CIMD warnings in this mode are informational and not a blocker.
- **Token endpoint auth method: `none`** (public OAuth client, no client secret).
- **Default scope: `pro_papa.read` checked**, base scopes blank; discovered authorization, token, issuer, resource, and OIDC endpoints were consistent with the real issuer/metadata checks.
- The callback URL field appeared **visually truncated** in a mobile screenshot. It must be copied by the builder's dedicated copy button, not inferred from the visible prefix. OpenAI documents the stable callback `https://chatgpt.com/connector_platform_oauth_redirect` when supported; the UI's actual copied URI remains the authoritative one. https://developers.openai.com/plugins/changelog .

**Next user action:** Create a **separate Auth0 Single Page Web Application** named `Pro-Papa ChatGPT Staging` (OAuth authorization-code with PKCE, public client, token endpoint authentication **None**). Configure **Allowed Callback URLs** using the exact copied ChatGPT callback URI; Auth0 requires exact matching, including path and trailing slash. https://support.auth0.com/center/s/article/Callback-URL-Mismatch-Error-Is-Not-in-the-List-of-Allowed-Callback-URLs ; https://support.auth0.com/center/s/article/Unauthorized-errors-seen-on-SPA-when-calling-oauth-token .

Then copy **only** the new application's client ID into ChatGPT's OAuth client ID field; leave OAuth client secret empty because `none` is selected. Do **not** use Auth0's legacy global client ID/secret. Ensure the application is permitted to use the staging API and `pro_papa.read` scope. Preserve DCR and CIMD tenant-wide settings unchanged. Test a real Auth0 authorization-code + PKCE login, token audience, scope and one signed authenticated tool call before claiming the connector is ready or switching the old Netlify-backed connection. No callback value or secret is stored in this repository.

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
