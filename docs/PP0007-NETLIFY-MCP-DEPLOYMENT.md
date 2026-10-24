# PP-0007 — Netlify HTTPS MCP endpoint (deployment candidate)

**Status:** This directory and `src/mcp-web.mjs` supply a Netlify Functions deployment *candidate*. Deployment, live private ChatGPT registration, OAuth and production interoperability are **not** established by repository CI. [Issue #24](https://github.com/Papa3445/Pro-Papa/issues/24) owns the live integration evidence.

## Purpose and invariants

The exposed `POST /mcp` tool is read-only and invokes the existing `createReferenceHost({traceMode:'enforced', auditMode:'off'})` for one explicit tool call. Only `verifyReleasedExecution()` permits a success `structuredContent`; unsuccessful or denied calls cannot be reported as completed. It still does **not** intercept ordinary ChatGPT replies or govern model reasoning. The response's local trace is neither signed nor provider authenticated.

Only `math.sum`, `text.metrics`, and read-only GitHub metadata for `Papa3445/Pro-Papa` are available. No write tools, GitHub usage receipt writes, execution of arbitrary code, or persistence of private prompts. Bearer authentication is mandatory for every call. Source tests simulate allowed metadata calls without external GitHub credentials.

## Netlify Git deployment plan — **do not publish until reviewed**

Create a **separate** Netlify project for this repository after independent PR review and branch merge. Do not reuse or replace existing Netlify sites.

This repo provides `netlify.toml`, which builds with `npm run check` and publishes only `public/`; JavaScript source and tests are **not** exposed as public static assets. The `netlify/functions/mcp.mjs` handler uses Netlify's Web `Request`/`Response` runtime (not the local Node `http.Server` listener) at `/mcp`. Deploy through Git-connected Netlify CI or an explicitly authorized deploy method. Do not create an empty Netlify site and claim it hosts the function.

Configure the following as **secret Function-scoped environment variables** using Netlify's UI/secret controls, never commit them to GitHub, send them in this chat, or put them in a shareable URL:

- `PRO_PAPA_MCP_TOKEN`: a *fresh* cryptographically random secret of at least 32 characters, shared only with the trusted MCP client. Rotate on compromise. ChatGPT custom MCP connection must support the matching API-key/bearer mode before this fixed-secret scheme can be used. **If ChatGPT's connection UI supports OAuth only**, do *not* turn off this authentication, paste the token into the URL, or publish a no-auth endpoint: design an OAuth 2.1 protected-resource/authorization-server integration in a separate reviewed PR.
- `PRO_PAPA_MCP_PUBLIC_HOSTNAME`: exact lowercase public HTTPS hostname for this **new** Netlify site (for example `my-private-mcp.netlify.app`, without `https://`, path, or port).

The handler refuses to function (503) if either credential or hostname is missing/invalid. HTTPS URL and hostname validation, explicit cross-origin deny-by-default policy, an IP-based declarative Netlify request rate limit, 64 KiB request size, 8 active calls per single instance, and restricted capability grants are enforced in code. Netlify access controls, secret scopes, gateway logging policy and build/deploy settings should be independently assessed before production.

**Production caveats:** Rate limits configured per platform do not replace an account-level quota. In-process concurrency counters are not global across function instances. The GitHub metadata request uses public read-only API access and can be rate-limited. Netlify Function packaging, shared secrets, TLS routing, and actual end-to-end connection require a real provider-backed deployment test.

## Connecting ChatGPT (only once an authorized endpoint is live)

In ChatGPT: **Plugins → Add → Add custom MCP server**, enter the HTTPS `/mcp` endpoint and select compatible authentication. If the UI doesn't accept a private bearer/API key, stop: ChatGPT authentication guidelines ordinarily require OAuth 2.1 for authenticated custom MCP servers, and ChatGPT cannot present an arbitrary custom API key. Do **not** weaken the server to make the scan pass. After connection creation (user action), explicitly select the plugin and run an authorized math.sum task. Verify the tool result contains the ordered release trace and a correct sum; also prove an uncredentialed request is blocked. Keep screenshots and tokens out of public GitHub.

Official guidance:
- [OpenAI: Connect custom MCP servers](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [OpenAI: MCP authentication](https://developers.openai.com/plugins/build/auth)
- [Netlify Functions](https://docs.netlify.com/build/functions/overview/)

## Tests and limitation ledger

`node --test tests/mcp-web.test.mjs` checks real Web Request/Response initialization, discovery, routing through an actual locally executed reference-host handler, denied tool results, negative bearer cases before an otherwise authorized GitHub metadata call, hostname spoofing, HTTPS enforcement, malformed JSON and oversized body. `npm run check` includes these tests in the existing repository suite. A separate provider deploy verification must confirm Netlify's URL routing and CI code packaging before any endpoint is called live.

Frozen PP-0007 21-pair manual ChatGPT baseline remains unchanged. The main task stays `in_progress`, with exact-head CI and authenticated independent security review required before merging or deploying this adapter.
