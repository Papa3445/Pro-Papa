# Pro-Papa: $0 development and hosting plan (no Netlify deployments)

Prepared 2026-11-02. **Owner constraint:** Do not deploy to Netlify, trigger builds/previews, change billing, merge to main or cut over production without separate authorization. A zero-dollar option must remain on a free plan within hard quotas.

This document describes work packages and **is not another task queue**. [The canonical framework ledger](../.pro-papa/tasks.json) alone controls tracked task state and dependencies under [AGENTS.md](../AGENTS.md).

## Verified baseline

As of this plan, the protected main SHA was d44b586d1f2b7583c1670260e4fa851450086e4f. The published Netlify MCP was still the older source a63eef80628de79df7ddbe6f84f2158b5e90603a (ready deploy 6ae28edeb6168e40983d64d9). [PR #62](https://github.com/Papa3445/Pro-Papa/pull/62) is a separate, unmerged PP-0009 closure candidate awaiting independent approval; do not change or merge that work as part of this plan.

The current HTTP endpoint is [netlify/functions/mcp.mjs](../netlify/functions/mcp.mjs), which wraps [src/mcp-web.mjs](../src/mcp-web.mjs) and [src/oauth-resource.mjs](../src/oauth-resource.mjs). It serves /mcp and /.well-known/oauth-protected-resource and relies on Node facilities such as node:crypto, Buffer and process.env. Repository commits do **not** automatically update the running host or ChatGPT Project instructions.

### Build prevention for this work

Use **[skip netlify]** in every commit message and **[skip netlify]** in the PR title. Netlify documents that the commit marker skips branch/production deploys and the PR-title marker skips Deploy Previews: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy . A later unmarked push could still deploy previous skipped changes; no unmarked merges or release pushes. Do not edit Netlify site settings. Avoid [skip ci] because we still want GitHub checks.

## A. Make the operator useful immediately (no provider work)

Change [prompts/universal-operator.md](../prompts/universal-operator.md) to require:
- Route the user's actual task to the most appropriate currently connected tool. Pro-Papa's available read-only MCP calls (bounded math, text metrics, opt-in artifact validation, allowlisted GitHub repository metadata) do not magically perform arbitrary research, web browsing, coding, or UI tasks.
- A mandatory connectivity check must not be passed off as task-specific work or inserted as boilerplate in unrelated user answers. Keep the truthful audit footer where required.
- Separate four kinds of evidence: a successful connection, a released MCP tool result, a GitHub usage receipt, and a genuinely verified user-facing deliverable.
- Report blocking failures immediately and specifically: which step failed, what was tried, what remains unfinished, exactly which user permission/credential/input is necessary, and the shortest safe enabling action.
- Do not promise background execution or imply failed writes were rolled back. Use native tools for documents, images and software when those tools actually exist.

**Acceptance:** commit/readback of the new prompt on a non-production branch; human inspection of examples: biography question uses independent sources, a valid math request uses its actual returned value, missing account authorization prompts one concrete request, and a successful GitHub receipt never substitutes for code tests.

**Activation:** this changed repository file is not automatically loaded as live ChatGPT Project instructions. Applying it in Project settings or a connected host is a separate authorized step.

## B. Offline runtime compatibility and regression work

Stage a separate scoped implementation PR when ready. Keep Netlify's deployed code untouched. First build a provider-neutral entrypoint and isolate environment/secret wiring while preserving the current OAuth/JWKS validation, host and origin restrictions, body-size limits, response trace, permission policy and /mcp transport.

Test the chosen runtime's node:crypto, Buffer, process.env, AbortSignal.timeout, Web Request streams, RSA/JWK import, JWT signature checks, metadata 401 challenge, tools/list, tools/call, 400/403/404/413/503 rejection and bounded GitHub fetch behavior. In particular, verify JWT verification and hashing CPU budget against the actual free provider limits; do not assume a green Node test implies Cloudflare runtime compatibility.

Run targeted offline tests and existing affected tests. Preserve scripts and evidence with the exact source SHA. No fake ChatGPT connection claims or tests that are only mocked described as live.

**Acceptance:** reproducible provider-target build, exact-head CI, mocked and runtime-specific tests, security review, and cost measurements that fit the free tier. Changes to tracked task state must follow the canonical CLI/task rules, not a second checklist in this document.

## C. Choose a genuinely $0 alternative

### Cloudflare Workers Free (first feasibility candidate)

Official limits: **100,000 requests/day, 10 ms CPU per HTTP request, 128 MB memory**, plus subrequest limits. An HTTPS workers.dev domain is available without purchasing a domain. Cloudflare documents stateless Streamable HTTP MCP handlers with optional OAuth. **Risks:** the 10 ms CPU limit, Node crypto/compatibility and OAuth resource-server integration must be measured, not guessed. No free-tier provider offers unlimited use.

Sources: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/ ; https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ .

### Deno Deploy Free (compatibility fallback)

Current advertised Free plan: **1 million requests/month, 10 active CPU hours, 20 GiB egress** plus further plan limits. Investigate whether its Node compatibility makes the current ESM/crypto implementation easier to run. Confirm actual OAuth and Web-stream behavior, zero-billing guardrails and whether onboarding requires a payment method. Do not assume support until tested.

Source: https://deno.com/deploy/pricing .

### Vercel Hobby (conditional faster Node.js path)

Vercel's documented Hobby plan is **$0/month**, with **1 million function invocations/month** and **4 active CPU hours** among its limits. Its Functions support a complete Node.js runtime and Web Standard fetch handlers, which may be a smaller adaptation from this project's Netlify/Node code than Cloudflare Workers. The **Hobby license restricts production deployments to personal, non-commercial use**; do not assume the project qualifies without the owner's confirmation. On Hobby, crossing the free quota can pause the service; stay on Hobby with no upgrade or billable features. A connected Vercel app can support future deployments, but connecting and deploying require user authorization and a real OAuth/MCP smoke test.

Sources: https://vercel.com/docs/plans/hobby ; https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/docs/plans ; https://vercel.com/legal/terms .

Paid overages, self-hosting power costs, free trials and required paid domains do **not** meet a strict $0 requirement.

**Selection gate:** choose only a compatible and secure HTTPS endpoint whose account is explicitly on the free plan, with an understood hard quota and no billable services enabled. If neither candidate passes, keep the existing code and report the blocker rather than incur charges.

## Verified implementation progress — 2026-11-02

- Draft [PR #63](https://github.com/Papa3445/Pro-Papa/pull/63): planning and revised universal operator instructions; no Project-settings change has been made.
- Separate draft [PR #64](https://github.com/Papa3445/Pro-Papa/pull/64): Vercel Node.js MCP entrypoint, a fail-closed static OAuth metadata generator, an /mcp rewrite, and offline RSA/JWKS regression tests. Exact-head [GitHub Actions run 41566337740](https://github.com/Papa3445/Pro-Papa/actions/runs/41566337740) passed **313 tests, 0 failures**. This is source and CI verification, **not** live hosting.
- Vercel documentation reserves the /.well-known path against rewrites. The adapter therefore generates the RFC 9728 metadata as a public static file; **serving that file at the reserved path is not verified** until a legitimate staging deployment. See [the staging gate](VERCEL-STAGING-GUIDE.md) in PR #64.
- Vercel was installed as a ChatGPT plugin, but its deployment/account tools were **not exposed as callable operations in this conversation**. No Vercel plan/usage check, project creation, deployment, real OAuth smoke test, or ChatGPT connector switch was performed.
- The owner must confirm that Hobby's personal/noncommercial restriction fits the intended use; provider onboarding must then verify the real account is on the strict $0 Hobby plan before any staging deployment.
- Both draft PRs are isolated from protected main and use [skip netlify]. PP-0009's existing PR #62 remains untouched.

## D. Optional future deployment and cutover (not authorized yet)

After the user has approved a separate provider/account and actual runtime compatibility is proven:
1. Create a separate staging HTTPS /mcp endpoint, without using Netlify.
2. Verify real ChatGPT connector initialization, OAuth challenge, resource metadata, JWT audience and scope, tools/list and genuine tool calls. Store secrets only in provider-managed settings; never commit credentials.
3. Configure a new canonical OAuth resource/audience and approved redirect URLs if the URL changes; do not simply reuse tokens for the old Netlify audience.
4. Confirm remaining free usage and billing controls from the actual provider console.
5. Independently review the exact release head and get explicit production cutover authorization. Reconnect ChatGPT only after the new server passes. Keep a tested rollback to the previous endpoint *only if that endpoint remains available*; Netlify credit exhaustion may make it unavailable.
6. Record actual smoke outcomes and separately close any authorized tracked task after its real proof obligations.

**Stop and ask the user** for one concrete action if provider account/permissions are missing, a charge could occur, an OAuth prerequisite fails, exact-head CI/review fails, or a GitHub merge might auto-deploy Netlify.

## Outputs and non-outputs of this plan

This planning change provides a versioned plan, improved operator-prompt source, a reviewable non-production PR and verifiable GitHub readback. It does **not** provide a deployed replacement, change live ChatGPT settings, grant provider credentials, authorize a merge, bypass independent review, or spend Netlify credits.
