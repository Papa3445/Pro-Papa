# PP-0007 gate 007-C — production denial and OAuth security coverage audit

**Status:** source-pinned historical verification audit, **not** a newly executed production JWT security assessment and not PP-0007 closeout. This change adds the [machine-readable coverage manifest](../fixtures/pp0007-007c-security-coverage.json) and contract regressions. The baseline code is public `main` at `39076ac85a6864dd007b9ed6c947389548878508`; `.pro-papa/tasks.json`, original fixture, OAuth deployment, Netlify settings, and credentials are unchanged.

## Production HTTP test: what actually passed

I independently read the provider metadata and job log for [GitHub Actions run 40163904908](https://github.com/Papa3445/Pro-Papa/actions/runs/40163904908), job `121080934380`. It is a real fixed-production-host invocation at PR #29's final reviewed head `ac5339b8c12424e27e5f7c66741599c5b58e7017`, **not** a mock-only suite. The probe output recorded `status:"passed"` and **five HTTP checks**:

| Production check | Expected observed behavior | What this supports |
| --- | --- | --- |
| `metadata-200` | Public `/.well-known/oauth-protected-resource` advertises exact resource and `pro_papa.read` scope | Only public discovery shape for that request |
| `get-mcp-405` | `GET /mcp` gets HTTP 405 | Method constraint for that GET |
| `no-bearer-tools-call-denied` | Missing bearer `tools/call` gets the exact correlated JSON-RPC denial, no extra result content | Response-level denial for one anonymous tool request |
| `invalid-bearer-tools-call-denied` | `Bearer not-a-jwt` `tools/call` gets the same exact denial | Response-level denial for one malformed bearer, **not** wrong-audience or wrong-scope signed JWT |
| `cross-origin-403` | POST from `https://untrusted.example` gets HTTP 403 | Rejection of that untrusted Origin |

The [probe source](../bin/pp0007-live-anon-probe.mjs) sends no valid token, cookies, private documents or user transcript. It tests a fixed `math.sum` attempt with harmless example numbers solely to verify denial. **Two checks test the exact authentication-denial envelope for missing or invalid bearer credentials; the third tool-call POST is rejected for an untrusted Origin. No five-vector signed-JWT production matrix was run.** The log explicitly reports `liveAuthenticatedJwtVerified:false` and `hostInvocationCountObserved:null`. HTTP error content is **not proof** that internal handlers were never dispatched. Code-level ordering is examined separately in tests.

## Review history, source and provider integrity

Initial independent [PR #29 CHANGES_REQUESTED](https://github.com/Papa3445/Pro-Papa/pull/29) exposed a real P1 flaw: the negative probe accepted a denial alongside leaked content or a mismatched JSON-RPC ID. The corrected [source](../bin/pp0007-live-anon-probe.mjs), Git blob `5bab1e75e8580fd0e765d18c41ff4597648e8be5`, now deep-compares the entire permitted JSON-RPC envelope and bound IDs `901` and `902`. Six negative regressions separately challenge leaked content, mismatched IDs and unexpected output fields for both requests. The final independent authenticated `papa4568` review approved only head `ac5339b8...`, not the rejected head.

- [Final PR #29 CI 40163904037](https://github.com/Papa3445/Pro-Papa/actions/runs/40163904037): **252 tests passed** at the reviewed head.
- [Final production live probe 40163904908](https://github.com/Papa3445/Pro-Papa/actions/runs/40163904908): result `passed` for the five specified HTTPS checks on the same head; the focused synthetic tests also ran in the workflow.
- [Merged-main CI 40164384595](https://github.com/Papa3445/Pro-Papa/actions/runs/40164384595): **252 tests passed**, project valid at merge commit `216d68e4395617ac9a9db7a6df9bb7062c7c9031`.

The manifest contains pinned exact Git blob identities for the historical probe, workflow, OAuth validator, MCP web handler and associated tests. The contract test recomputes source Git blob identities; for the Netlify entrypoint alone it permits **either the original historical blob or the exact separately proposed PR #38 remediation blob** with its dedicated regression file present. Other source pins reject drift. Both source versions remain explicit; this does not label the candidate independently approved or live. This is **code/manifest consistency**, not an extra production probe; future implementation edits require a re-audit of affected pins.

## Separate local/synthetic security evidence — do not promote to production observations

[OAuth resource tests](../tests/oauth-resource.test.mjs) generate RSA-2048 tokens and feed a **mock HTTPS JWKS**, checking issuer, audience, required scope, exp/nbf/iat, signatures, tampered headers, untrusted JWKS keys, redirects, size limits and key caching. [MCP OAuth web integration tests](../tests/mcp-oauth-web.test.mjs) exercise synthetic tokens against the in-memory request handler and verify the host executes only after valid authorization, with a checked release trace. Local [HTTP tests](../tests/mcp-web.test.mjs) cover Host/Origin restrictions, request bounds and the prohibition of a legacy static-token fallback for the Netlify OAuth function. These tests check implementation logic but **have not submitted a real, validly signed adversarial JWT to the production function**.

The released host trace is scoped to one explicit MCP tool response. Its `providerAuthenticated:false` describes local handler provenance, not the separate ChatGPT-to-OAuth transport. A successful per-tool trace or separately verified GitHub usage receipt neither authenticates the model's internal reasoning nor intercepts other ChatGPT responses.

## Positive production integration: bounded and attribution-limited

[Issue #24](https://github.com/Papa3445/Pro-Papa/issues/24) records operator-observed OAuth-connected ChatGPT MCP math/text/repository-read smoke tests and corroborating Netlify-origin production requests. One `math.sum([2,3,5])` returned `total:10`, `count:3` with a `released` host-local trace, and a private GitHub receipt was independently validated in a separate transaction. However, the Netlify edge log did **not** preserve the complete JSON-RPC method/payload for the original UI invocation; an additional independently executed math tool call is **not authentication of the original call's exact payload**. No signed JWT itself or complete claim-by-claim production trace is published. These observations support **bounded connection/capability execution**, not all-turn governance, protected-resource adversarial completeness or general-user-task quality.

## Security claims still unproved by live evidence

- Authenticated **production** tokens bearing wrong `iss`, `aud` or `scope`; expired-but-validly-signed claims, `nbf` violations, signature/algorithm confusion or pinned-JWKS rotation failures.
- Production token revocation, replay, client registration/PKCE abuse, globally enforced rate controls, and full multi-instance threat behavior. **The per-handler eight-active concurrency cap is independently known from source to be ineffective across independent Netlify request invocations; it is not merely untested.** See the lifecycle findings below.
- Independent proof of zero internal host executions during denied calls, cryptographic binding of historical ChatGPT conversations to specific MCP JSON-RPC payloads, or interception of all ChatGPT messages.
- Quality/correctness of arbitrary software, documents, Q&A or generated images via the **read-only** MCP. Native ChatGPT tools are separate.

Those items are explicitly `not_proven_by_this_evidence` in the fixture **for the wider production claims**, but the local concurrency and JWKS-cache lifecycle defects below are explicitly **source-established**. The not-proven items are not failed JWT tests; the two lifecycle defects are actual source-design limitations, not speculative missing test outcomes. Stronger live JWT tests require an appropriately authorized, narrowly scoped, reviewable new security exercise; operator-controlled provider credentials and a safe environment must not be embedded in public fixtures. Broader adversarial testing can be a future security milestone rather than blocking an honest *narrow* connection claim, but must be completed before any broader production-safety assertion.

## Independent reviewer findings: proven Netlify request-lifecycle defects

Independent whole-system review [issue #36, findings F-02/F-03](https://github.com/Papa3445/Pro-Papa/issues/36#issuecomment-6405253276) submitted **CHANGES_REQUESTED** against the previous #35 head. This section corrects the previous ambiguity between an untested *distributed* control and a demonstrably ineffective *per-request* local implementation. Both findings are grounded in code at immutable main `39076ac85a6864dd007b9ed6c947389548878508`, not a production load test or proof of exploitation.

| Finding | Verified cause from exact pinned source | Honest status |
| --- | --- | --- |
| **HIGH — no cross-request concurrency guard** | [Netlify entrypoint lines 10–25](../netlify/functions/mcp.mjs) calls `createReadOnlyMcpWebHandler` on **each** request. [Handler lines 106–111 and 181–186](../src/mcp-web.mjs) create `let active=0` in that new closure and enforce max eight **only within that closure**. Distinct requests use distinct counters. | **Known ineffective across independent serverless requests.** Netlify's separate per-IP `rateLimit` is not the same as a distributed concurrency guard; it has not been load-validated here. No claim of a deployed exploit. |
| **MEDIUM — JWKS cache resets between requests** | The entrypoint also creates a fresh [OAuth validator](../src/oauth-resource.mjs) per request. Its `state` and `refreshing` variables at lines 91–108 are scoped to each instance. The specified 300-second JWKS cache cannot serve the next request through a newly constructed validator. | **Known no cross-request cache reuse** under this wrapper. Additional lookup/availability dependency is source-established, but actual production p95, token-exchange latency and JWKS request counts remain **unmeasured**. |

The regression `tests/pp0007-007c-netlify-lifecycle.test.mjs` uses *locally signed RSA fixture tokens* and an injected local JWKS fetch. It exercises the **real Netlify entrypoint** twice sequentially and seven times concurrently (below the local capacity threshold). Against the original pinned implementation it detects **nine distinct JWKS lookups**; against the explicitly pinned proposed warm-instance remediation from [PR #38](https://github.com/Papa3445/Pro-Papa/pull/38), it expects **one shared lookup**. The revised test rejects any unrecognized entrypoint source Git blob. The archived original-source finding remains true for the old commit; the new code is **neither approved nor deployed** merely because an integration test passes. It does not estimate production latency, test distributed capacity, exercise real JWTs or validate cold starts. Source-level counter scope and branch behavior are independently pinned in the fixture; no deployment code changes are made here.

A separately reviewable runtime correction is tracked in [issue #37](https://github.com/Papa3445/Pro-Papa/issues/37), with explicit safe state sharing, fail-closed configuration, cache rotation and an honestly bounded concurrency claim. **PR #35 only corrects and tests the security audit; production remains unchanged.** A repository administrator must separately implement native GitHub merge protections as described in [issue #36](https://github.com/Papa3445/Pro-Papa/issues/36); this documentation PR cannot enforce release governance.

## Separate reference-host fail-closed cases

The [canonical host benchmark](PP0007-BENCHMARK.md) records four negative cases: unallowlisted repository/no outbound call, missing software handler unsupported, unauthorized GitHub issue creation denied without POST, and a fabricated private audit confirmation rejected. Those tests are **not** production OAuth HTTP tests and do not establish malicious prompt resilience for all contexts. Do not count safe denials as completed user requests.

## Completion boundary and regression gate

`tests/pp0007-007c-security-coverage.test.mjs` validates immutable baseline source blobs, the **five exact** live-check identifiers, strict separation between live probes and local synthetic RSA claims, adverse reviewer history, unknown internal host invocation, and a permanent **not-proven** matrix for sensitive claims. It cannot independently reproduce the historical HTTPS requests or authenticate a private ChatGPT conversation. No fresh model, provider or token operations were initiated in this increment.

**Result:** 007-C security inventory prepared; independent exact-head review is still required. PP-0007 stays `in_progress`. Gates 007-D (overhead/corrections), 007-E (artifact proof) and 007-F (independent reviewed milestone closeout) remain open.
