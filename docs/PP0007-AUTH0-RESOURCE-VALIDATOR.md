# PP-0007 — Auth0 MCP OAuth Resource Validator (independent increment)

**Scope:** A reusable resource-server validation module, `src/oauth-resource.mjs`, with signed-token fixtures and adversarial tests. It is **not** plugged into the active Node or pending Netlify MCP endpoint, does not implement an OAuth authorization server, does not create an Auth0 API/client, does not provision credentials, and does not intercept native ChatGPT turns. The frozen prospective benchmark remains unchanged.

## Contract

The standalone factory `createOAuthResourceValidator({issuer,resource,scope,fetchImpl,now,cacheSeconds})` requires:
- An HTTPS Auth0 tenant issuer with **exact trailing slash**, e.g. `https://civilian-tenant.us.auth0.com/`.
- The final canonical MCP resource **origin without trailing slash**, e.g. `https://final-private-mcp.netlify.app`, whose exact value must also be configured as the Auth0 API identifier/token audience. **Do not configure a tentative audience**; it cannot be changed easily after API creation.
- A tool permission scope (default `pro_papa.read`). No built-in provisioning of Auth0 API scopes; administrator must authorize only intended civilian users and client connections.

It supports:
- Public RFC 9728-style metadata `{resource,authorization_servers,scopes_supported}` from `metadata()` or `metadataResponse()`. A future HTTP integration must explicitly route `GET /.well-known/oauth-protected-resource` to that method.
- Bearer challenge with `resource_metadata`, `scope`, and `invalid_token`/ `insufficient_scope`. A future MCP integration must issue it as HTTP 401 for missing/invalid authorization, and add correct MCP tool `securitySchemes` plus the `_meta["mcp/www_authenticate"]` error hint when needed.
- `verifyAuthorization('Bearer <JWT>')` returning boolean. **Only** an Auth0-issuer RS256 signature with trusted RSA key from `https://<issuer-host>/.well-known/jwks.json` can pass. Exact configured `iss`, exact expected `aud` (string or array), integer `exp`, integer `iat`, optional `nbf`, nonempty subject and space-delimited required `scope` are required. Invalid, missing, expired, wrong-audience, wrong-scope and forged-header/signature tokens fail closed. The module does not log, store or echo tokens.
- Pinned HTTPS JWKS origin with `redirect:'error'`, 5-second fetch timeout, 32 KiB maximum key-response body, 20-key maximum, minimum 2048-bit RSA keys, unique bounded `kid`, strict RS256 algorithm, caching for 60–600 seconds. HTTP/invalid JSON or failed key fetches deny access. No JKU/x5u/jwk-based remote key selection or dynamic issuer metadata redirects.

## What is NOT proven

1. This module is **not integrated** into PR #25's fixed-token Netlify Web handler. That PR is under separate independent review and remains an un-deployed candidate. OAuth integration must be a **new scoped PR** after the pending deployment branch has been approved/merged or carefully rebased.
2. Local tests use synthetic RSA-2048 public/private fixture keys with a mock pinned HTTPS JWKS response. They cannot prove the actual civilian Auth0 tenant, API audience/scope, OAuth client registration, authorization-code + PKCE, deployment, token exchange, or a successful ChatGPT connection.
3. ChatGPT's custom MCP requires an OAuth-enabled authorization server that supports the chosen client method (CIMD, DCR, or a predefined client with the correct redirect URI), PKCE S256, audience-bound tokens, and authorization server discovery. DCR and CIMD are currently disabled in the operator's Auth0 tenant as shown in a screenshot; do **not** switch them on by default. Do not use any government-managed identity provider. This module does not supply authorization-server functions or policies.
4. The configured issuer's public OIDC discovery endpoint was **not independently accessible** from this session. The tenant's existence and visible settings are supported by user screenshots only; avoid declaring provider trust until deployed discovery succeeds.
5. The returned boolean establishes token validity in the module's threat model; it does **not** identify ChatGPT as the OAuth client, sign a reasoning trace, or govern ChatGPT response release. The eventual tool response still must use the host execution-release gate and independent end-to-end evidence.

## Test

`npm run check` includes `node --check src/oauth-resource.mjs` and the existing `node --test` suite, with `tests/oauth-resource.test.mjs` covering provider metadata, correct RS256 verification, negative scope/audience/issuer/expiration, key injection, tampering, invalid JWKS, undersized RSA, malformed tokens, dangerous URLs, and deterministic JWKS-cache expiry.

References:
- [OpenAI Plugin OAuth/MCP authentication](https://developers.openai.com/plugins/build/auth)
- [Auth0 — Validate access tokens](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)
- [RFC 9728 — Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)

**PP-0007 remains `in_progress`**. Do not merge without exact-head provider CI and an independently authenticated GitHub approval.
