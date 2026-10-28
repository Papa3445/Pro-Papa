# PP-0009 — Privacy-safe per-call MCP correlation (implementation candidate)

## Scope and actual meaning

The Netlify OAuth MCP adapter (`src/mcp-web.mjs`) and local loopback adapter
(`src/mcp-bridge.mjs`) issue a **new random correlation ID per accepted,
explicit, authorized `tools/call` request** after the tool's capability is
validated. It is returned in `result._meta['pro-papa/call-provenance']` and the
JSON result text; on successfully released results it is also in
`result.structuredContent.callProvenance`. A capacity-denied, already
validated request receives status `capacity_denied` and an ID, **without** a
released execution trace or `structuredContent`.

This does **not** govern, intercept or prove any other ChatGPT response, tool
connection, native artifact generation, `initialize`, `ping`, `tools/list`,
unauthenticated call or invalid-arguments request. No invented method or
approval is attributed to those connectivity-only and preauthorization checks.

The returned record includes:
- `id`: cryptographically random UUID, freshly minted per accepted call.
- `method: tools/call` and the server-verified `capability`.
- `status`: actual host result (`completed`, `denied`,
  `provider_unavailable`, `capacity_denied`, etc.).
- `executionSha256`: digest from the actual *released and validated* reference
  host trace, or `null` if no valid trace was released.
- `requestHmacSha256`: HMAC of the **full received request envelope**,
  correlation ID, capability, status and trace digest, keyed by an ephemeral,
  random **server-side secret that is never transmitted or logged**.
- `scope: single_explicit_mcp_tool_call`,
  `retention: response_only`, `providerAuthenticated: false`.

## Verification and privacy

Within one handler instance, `createMcpCallProvenance().verify` checks record
shape, method, exact original call, capability, result status, execution digest
and a constant-time HMAC comparison. The adapter verifies the record before
release; tampered status, ID, payload, capability or digest is rejected. Only
trusted host code holds the key. Random IDs avoid time-window inference and
unsafe replay equivalence; repeated identical requests receive distinct IDs.

The key does **not** persist across warm/cold instances or deployments.
Operators can compare the response's duplicated correlation fields and match
the recorded status/digest to the **same actual tool response**. The public
record does not permit third-party recomputation of the HMAC after a process
ends: that limitation is intentional to avoid publishing reversible hashes or
a verifying secret. No raw prompt, JWT, authorization header, artifact bytes,
session identity, or full inputs are persisted or logged by this feature.
Existing Netlify access log behavior is outside this implementation's scope.

A response-only record is not a GitHub usage receipt, durable audit trail,
provider signature, independently authenticated invocation ID or proof that a
ChatGPT conversation used the MCP. The existing `trace.providerAuthenticated:
false` remains unchanged; it describes the local execution provider rather
than the OAuth bearer verification. A third party can still forge an entire
response outside the trusted host. Trust requires the actual authenticated
tool response and its source/provenance, not a self-authored copied JSON.

## Smoke and release acceptance

1. Test the actual app's explicit `math.sum` invocation with a valid OAuth
   grant in a separately authorized, bounded production smoke **only after**
   the protected reviewed implementation is deployed.
2. Check the returned correlation ID, `tools/call`, capability, completed
   status, matching HMAC record copies, and `trace.executionSha256` against
   `callProvenance.executionSha256`; verify `verifyReleasedExecution`.
3. Independently verify a wrong/expired token or malformed argument is denied,
   and a `ping`/discovery request cannot be misrepresented as a completion.
4. Capture only the redacted ID, status, digest and verified deployment commit
   with bounded retention; do not copy OAuth tokens, objectives or artifacts.
5. If OAuth host access, production approval or independent review is missing,
   record the smoke result as **not run**, keep PP-0009 `in_progress`, and
   do not call the unit tests or Netlify preview a live production pass.

The per-process eight-active limit is unchanged and is **not** a distributed
global quota. Production artifact validation remains governed by its separate
feature flag and must not be silently enabled as part of PP-0009.
