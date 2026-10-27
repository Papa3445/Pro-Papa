# PP-0007 / issue #37 — warm Netlify MCP handler lifecycle

**Review-only implementation candidate. No deploy, secrets, changed Auth0 credentials, or claim of globally distributed concurrency.** Based on pinned main `39076ac85a6864dd007b9ed6c947389548878508`.

The independent [whole-system review](https://github.com/Papa3445/Pro-Papa/issues/36#issuecomment-6405253276) found two actual source-lifecycle defects: the Netlify wrapper instantiated a fresh OAuth validator **and** MCP handler on each request, losing the 300-second JWKS cache and making `active<8` ineffective *between independent requests*. This patch hoists the validator/handler into a **warm-instance module cache**, keyed on **all three** runtime public configuration values (`hostname`, Auth0 `issuer`, canonical resource). Every request checks configuration; missing/invalid/changed configuration invalidates the previous cache and fails closed if invalid. An in-flight request holds a local reference to its already validated handler; no credential, request body, bearer, or private data is stored in the cache.

Consequences and limits:

- Repeated valid tool calls in the **same warm instance** share one trusted JWKS cache, with existing validator-controlled expiry, refresh, signature checks and failure handling. A new cold start or different instance has its own keys and instance state.
- The handler's existing eight-active guard is now meaningful **within that warm instance**, not across separate Netlify instances/regions. The separately configured Netlify IP rate limit is distinct. **No distributed/global concurrency guarantee is implemented or claimed.**
- Local regression tests use synthetic RSA fixture JWTs, intercept all HTTPS fetches and check cache reuse, JWKS TTL expiry and rotation, issuer/resource changes, missing config, outage fail-closed behavior, and nine concurrent in-process tool calls with eight held GitHub research operations plus capacity refusal for the ninth. Tests make no real HTTP/production Auth0 calls. Any observed time/cost improvement is unknown without independently measured provider data.
- Provider independent review must challenge possible stale-configuration reuse, hostile token replay, cache TTL behavior, warmed-cold scope confusion, deny shape, concurrency test timing, exact-head CI, and ability to safely roll back. **This does not itself fix the repo's unprotected `main` branch or PP-0007 acceptance.**

Acceptance for this incremental PR is a correct warm-instance fix with passing exact-head CI and genuine independent review. **Deployment requires a separately authorized reviewed release, verified Netlify deployment SHA and safe positive/negative production smoke**. Do not merge or deploy by merely reading this documentation.
