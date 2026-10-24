# PP-0007 — Auth0-protected Netlify MCP integration candidate

**Status: code candidate, not deployed.** This PR integrates `createOAuthResourceValidator` with the Netlify MCP Web handler for **explicit** tool calls, not automatic ChatGPT answer interception. It does not register any real user, create an Auth0 API/client, set Netlify secrets, provision a site, or verify real OAuth login. See [issue #24](https://github.com/Papa3445/Pro-Papa/issues/24).

## Request paths and verified trust boundary

- `GET /.well-known/oauth-protected-resource` returns RFC 9728 metadata with the canonical resource, Auth0 authorization server and `pro_papa.read` scope **without** user authentication. Netlify maps this and `POST /mcp` to the same Function via documented array path routing.
- `POST /mcp` permits only read-only anonymous `initialize`, `ping`, `tools/list` discovery calls. `tools/list` declares `securitySchemes:[{type:"oauth2",scopes:["pro_papa.read"]}]`. No model-triggered tool executes without a signed Auth0 bearer token.
- `tools/call` checks the provided token with `verifyAuthorization` **before** invoking `createReferenceHost({traceMode:"enforced",auditMode:"off"})`. Missing/invalid tokens receive `isError:true`, no `structuredContent`, and `_meta["mcp/www_authenticate"]` bearing an OAuth metadata challenge with `error_description`. The handler's actual successful response still requires `verifyReleasedExecution()` on host-returned execution.
- The already-reviewed legacy JavaScript constructor path accepts a host-managed 32-character minimum bearer token **only when no OAuth validator is supplied**. Supplying both the static bearer and OAuth validator is rejected. The deployed Netlify Function **does not use or accept a static bearer token**, preventing accidental ChatGPT OAuth bypass.
- For other denied requests the server rejects malformed JSON, unsupported methods/protocols, oversized request bodies and Host/Origin/HTTP downgrades. Repository research remains allowlisted to the Pro-Papa **public** repository. No issue creation, code execution, GitHub receipt writes or other external write tools are enabled.

## Functions-only runtime configuration

Create a new and separately scoped Netlify site only **after independent code review**. Keep a stable project hostname; do not use a placeholder or switch an Auth0 API audience after API creation.

Configure these names in Netlify Functions-scoped runtime configuration (do not commit them or any credentials). All are required and the Function returns **503** on missing or inconsistent values:

- `PRO_PAPA_MCP_PUBLIC_HOSTNAME`: exact final lowercase hostname, no scheme, port or path.
- `PRO_PAPA_MCP_RESOURCE`: exact `https://` + hostname **without trailing slash**, also used as Auth0 API Identifier (audience). Must be consistent with the actual OAuth `resource` parameter.
- `PRO_PAPA_AUTH0_ISSUER`: exact personal/civilian Auth0 HTTPS issuer **with trailing slash**, such as `https://example.us.auth0.com/`. Must match the issuer in actual access tokens; signed RS256 tokens are verified against only that issuer's pinned JWKS. No military or organizational identity provider.

The Function no longer requires `PRO_PAPA_MCP_TOKEN`. Do not add a static bearer fallback or expose any token in URLs. Static source, docs and tests remain outside Netlify's `public/` publish directory. Rate limits, 64 KiB body maximum and per-instance concurrency guards are not global traffic quotas; actual Netlify build/package/TLS behavior remains unverified.

## Auth0 / ChatGPT client-registration dependency

- The operator created a civilian Auth0 tenant and showed **Resource Parameter Compatibility Profile enabled**, **DCR disabled**, and **CIMD disabled**. This is user screenshot evidence, not authenticated provider API verification.
- Complete the final Netlify HTTPS hostname **before** creating the Auth0 API identifier `PRO_PAPA_MCP_RESOURCE`. Add the minimally scoped API permission `pro_papa.read` and an allowlisted civilian user. Configure authorization-code + PKCE S256, and select a compatible ChatGPT client-registration approach: predefined client using the exact redirect URI shown in the plugin management UI, or carefully reviewed DCR/CIMD only if enabled and supported. Do not enable unrestricted third-party client registration merely to make a test pass.
- Confirm provider metadata at `https://AUTH0_DOMAIN/.well-known/openid-configuration` advertises authorization and token endpoints, matching issuer and PKCE S256. Auth0 access tokens must contain exact resource audience and scope. Check whether token header conventions, `iss` and `scope` match the reviewed validator in live tests.
- ChatGPT connection is a separate, user-authorized action. Custom MCP form exposes OAuth but no live connection has been attempted. Do not mark PP-0007 complete until the remote URL, token exchange, discovery, negative token tests and actual signed host execution trace have been independently observed.

## Testing, independent review and limitations

Run `npm run check`. Legacy static-token test fixtures remain supported for the **local-only** library constructor. `tests/mcp-oauth-web.test.mjs` uses genuine generated RSA-2048 signatures and a synthetic JWKS fetch to assert OAuth metadata, anonymous discovery, correct tool security schemes, invalid-token error hints, blocked GitHub handler invocation before authorization, signed-token acceptance and validated execution trace.

This is **not** proof of a production Netlify deployment, a real Auth0 access token, OAuth client registration, interactive PKCE login, actual ChatGPT plugin, all-turn governance or independent benchmark quality. All production integration and tests remain blocked pending a scoped independent PR approval and provider deployment controls.

Official documentation: [OpenAI MCP OAuth](https://developers.openai.com/plugins/build/auth) · [Netlify multiple Function paths](https://docs.netlify.com/build/functions/configuration/) · [Auth0 MCP resource audience compatibility](https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0).
