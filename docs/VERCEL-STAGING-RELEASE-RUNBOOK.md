# Vercel MCP staging: reproducible source, attestation, and rollback runbook

This is a **review gate**, not deployment or merge authorization. The dedicated Vercel Hobby project is **pro-papa-mcp-staging**, team **team_vEgIRliWXQMyHAWaZp59je14**, project **prj_QOcJEubys5o8pdlyC30I0E7uuzK0**. It has no Git deployment integration. Preserve the original Netlify service and ChatGPT connection. Never trigger Netlify builds, previews, deploys, or calls.

## Historical deployed-source verification (2026-11-03)

The current READY deployment **dpl_y6WTePYdcAynSsDw1ozGPnUjQsQA** reports Git source commit **c2f21f91d239fcf7ed0edfaa574706c2ec2fbf80**, which is older than the PR head. Vercel's provider-backed file tree exposes content-addressed **SHA-1 of raw file bytes** in each file's `uid`. This was independently calibrated against `vercel.json`: raw-file SHA-1 `6262b4f3d4d20f7e115a484bce004c18351f707a`, Git blob SHA-1 `d6268b51890fb23a35604fecea88fff098b2e6a5`. The two digests intentionally differ because Git adds its `blob <length>\0` header.

At that immutable Git commit, all **17/17 tracked source files** below were fetched from GitHub, Git blob SHAs recalculated, and raw-file SHA-1 values independently recalculated; all **17/17 Vercel file UIDs matched**. No file mismatch was detected.

| Source file | Vercel raw-file SHA-1 / `uid` |
| --- | --- |
| `api/mcp.mjs` | `1d5a431f442069d5e07a92608a3e91300b05d44a` |
| `bin/render-vercel-oauth-metadata.mjs` | `cef6d8190fa9561c45f61a53fe9ce29c78ba39f3` |
| `package.json` | `fd347d58b51a2f2d2a48b330e4e0224c7432f132` |
| `src/artifact-validation.mjs` | `04f8fe0ef59ef380911b5f13f4f3832ef9e2cf47` |
| `src/core.mjs` | `4d176d580a4e48dbb2077338bd690b95f83da795` |
| `src/execution-trace.mjs` | `8a70835c50c2121c70f25c87607f78a84981b4dd` |
| `src/gateway.mjs` | `6b7bfbd17fb1ae0d28f4229575b3f5192bc2ffe8` |
| `src/iso-date.mjs` | `a34aad082143c32cf242fb857ddcbdc913bd51d7` |
| `src/mcp-call-provenance.mjs` | `512abbca0b6aaf20388f92cb9b6b0ea69b4a8ae1` |
| `src/mcp-web.mjs` | `b20d391438d8a1f1c6d66c5e7258e59529a76e7d` |
| `src/memo.mjs` | `8bd74cf96cb846be4ed931e70bda24d6a49be18b` |
| `src/oauth-resource.mjs` | `eada4e02d0e3d860d0be235eb6ddab300b0cc73` |
| `src/planning.mjs` | `d48c15bad1e191a2e7e9569cd4f774be94169789` |
| `src/reference-host.mjs` | `1fa9498bbb82bba4658a09cedf45c5e062358049` |
| `src/review-github.mjs` | `5ce3b2821bad9bffc76623ed4b34bf49751806fb` |
| `src/usage-receipts.mjs` | `d450ccde9bf34170c1d306e224710b9621a99c6b` |
| `vercel.json` | `6262b4f3d4d20f7e115a484bce004c18351f707a` |

The eighteenth Vercel source file, `public/.well-known/oauth-protected-resource`, is **generated at build time**, not tracked in Git. Its provider source-file response was short enough to read completely; SHA-1 `777d8930f371d2236f060b31b27ee79b76a27763` matches its `uid`. The decoded JSON lists the exact staging resource `https://pro-papa-mcp-staging.vercel.app`, Auth0 issuer `https://dev-tzvdy337r0wqo8r5.us.auth0.com/`, and `pro_papa.read`. These are identifiers, not access tokens.

**Assurance boundary:** Vercel's `uid` exposes SHA-1 identities, not SHA-256 or complete runtime-bundle readback. The platform's larger file-content responses were truncated. This is strong corroboration of the **uploaded source identity**, but it is not a cryptographic signature, a proof of compiled Lambda byte identity, proof of an untampered provider, or a demonstration of rollback. The post-deployment PR fixes (including the no-ambient-GitHub-token change) are **not** running in the current deployment.

## Deterministic source preparation (no deployment)

Use an exact clean detached Git commit. The source exporter must not read or copy .env files, Git credentials, Netlify source, repository-only docs, or other unlisted files. Node.js's built-in crypto library calculates SHA-1 for comparison with Vercel source UIDs and SHA-256 for stronger local manifest validation. The generated manifest is stable for the same files and source SHA, independent of clocks and file metadata.

From the root of a clean, checked-out and pinned PR commit:

```bash
node --version
npm run check
node bin/prepare-vercel-staging-source.mjs \
  --commit "$(git rev-parse HEAD)" \
  --output "/tmp/pro-papa-vercel-bundle-$(git rev-parse HEAD)"
```

The exporter rejects mismatched commit arguments, dirty tracked checkouts, source symlinks, non-regular files, preexisting output directories, and output paths inside the checkout. The output has exactly the 17 allowlisted runtime-source files plus `pro-papa-staging-source-manifest.json`. Do not place secrets in this bundle.

This preparation has offline unit tests. It does **not** log in to Vercel, generate an Auth0 access token, build the production Lambda, or deploy anything. Vercel will generate the public OAuth resource metadata at build time using **host-managed** environment variables already provisioned on the staging project.

## Deployment/release procedure — requires separate owner authorization

1. **Source and authorization gate.** Record the exact PR head SHA, independent security reviewer state, and exact-head GitHub CI (including Node.js 26 verification). Confirm personal/noncommercial Hobby eligibility and available free-tier quota. Confirm no Git push or merge can cause a Netlify deployment; `[skip netlify]` on every relevant commit and PR is a safeguard, not proof of Netlify trigger configuration. Do not merge.
2. **Reproducible candidate.** On a host with explicit owner deployment approval, use the clean pinned checkout and exporter above, then deploy only the allowlisted output to the dedicated Vercel project. Prefer a **staged production-target build without domain assignment** (for example `vercel deploy --prod --skip-domain`, subject to the selected CLI version and project configuration), not immediate modification of the canonical MCP URL. Keep Vercel credentials in the authorized host's environment; never print a token or `vercel pull` secret contents. Pin the CLI version, project ID, team ID, commit SHA, and supplied file-manifest digests. Do not attach automatic Git deployment or enable paid features without separate approval.
3. **Attest the candidate.** List Vercel deployment source files, compare each `uid` against the pinned manifest's SHA-1, and verify the generated OAuth resource JSON. Independently inspect current environment metadata without disclosing secret values. Record the exact deployment ID, source commit, runtime version, and readiness. A source hash match does not prove the generated Lambda bytes. Reject unknown files or digest mismatches.
4. **Safe smoke before promotion.** At the candidate deployment URL, verify static RFC 9728 metadata, `initialize`, `tools/list`, anonymous/invalid-token denials, canonical-host/Origin rules, and a correctly scoped Auth0 `tools/call` when the provider's hostname/audience design permits it. Do not weaken OAuth or change the configured audience merely to make a preview URL work. If hostname validation only permits the stable domain, document this coverage limit and require an explicitly approved, reversible stable-domain test.
5. **Release approval and rollback readiness.** The current project has **only one READY deployment** (the source-pinned `dpl_y6WTePYdcAynSsDw1ozGPnUjQsQA`) and one older **ERROR** deployment, which is not a usable rollback candidate. A genuine rollback test cannot be completed until a second READY candidate is created and promoted with separate owner approval. Preserve the old READY deployment ID. After a promotion, perform the approved rollback to the prior READY deployment if needed, verify stable-domain MCP health and release behavior, and re-promote only with separate authorization. Vercel rollback can pause automatic domain assignment; inspect resulting state rather than assuming it is unchanged.
6. **Final security gates.** Independently re-review the new exact PR head, WAF active rule (30 requests / 60 seconds / IP for `/mcp` and `/api/mcp`, limited per region), Auth0 signed-token execution, deployment artifact evidence, and exercised recovery before any merge or retirement of the original ChatGPT/Netlify connector.

## Isolated pinned candidate — created and source-verified 2026-11-03

With separate owner authorization for **a candidate with no domain assignment**, Vercel received exactly the 17 allowlisted runtime source files read at GitHub PR #64 commit `36448b56e6b5e0ff049fa2068d5f3b586702403c`. Project `prj_QOcJEubys5o8pdlyC30I0E7uuzK0`, on Hobby, already had the four relevant host-managed OAuth variables scoped to **Preview**, so no variable or Auth0 changes were needed. The API `create_deployment` call intentionally omitted `target` (Vercel default **preview**); it did not assign any stable-domain aliases.

- New preview deployment: `dpl_9CeZA3UC5EBcFhUwjBFwG6PFoqG4`, status **READY**, `target=null`, `alias=[]`.
- Preview URL: `https://pro-papa-mcp-staging-4m1rw4ysi-fpspro0421-1213.vercel.app`.
- Provider build log: `Downloading 17 deployment files`, `Build Completed in /vercel/output`, `Deployment completed`; Vercel CLI 65.4.0; warnings include unpinned Node.js engine `>=20`.
- Provider deployment source tree: exactly **17** tracked files. Their content `uid` SHA-1 digests match the **17/17** exact GitHub source files at the pinned commit. Independently recomputing the Git blob SHA-1 also matched **17/17** pinned GitHub blob IDs. Source identity is verified; **compiled Lambda bytes are not independently attested**.
- Credential-free HTTPS check: [GitHub Actions run 41738121489](https://github.com/Papa3445/Pro-Papa/actions/runs/41738121489) succeeded. Preview `/.well-known/oauth-protected-resource` returned HTTP 200 with expected resource/issuer/scope; preview `/mcp` and `/api/mcp` returned HTTP 404, consistent with the strict **canonical hostname** guard (not a positive authenticated execution test); original staging `GET /mcp` returned HTTP 405.
- Verified after deployment: the previous READY deployment `dpl_y6WTePYdcAynSsDw1ozGPnUjQsQA` still has both original aliases `pro-papa-mcp-staging.vercel.app` and `pro-papa-mcp-staging-fpspro0421-1213.vercel.app`. A real connected staging `math.sum(2,3,5)` call still returned 10 with `completed` and released trace.
- The later Git branch commit `01ef35bd71885623c3cdf4e339e331411c93cf0d` added the credential-free smoke workflow **after** deploying the pinned candidate. That commit does not change candidate runtime source.

**Release boundary:** The new READY deployment is a **preview** and is not a tested production-target rollback candidate. Its preview-host HTTP 404 behavior means that a genuine new-version authenticated MCP call has **not** been demonstrated. Before any canonical-domain promotion, obtain explicit separate authorization to produce a production-target build **without domain assignment**, reattest its source, and plan an actual rollback to the preserved original READY deployment. Do not automatically promote the preview (Vercel may rebuild preview artifacts using production settings) or change Netlify, Auth0, the stable staging domain, or the existing ChatGPT connector.

## Staged production-target candidate — owner-authorized 2026-11-03

The owner separately authorized creating a **production-target build in the same Hobby staging project without assigning any domain**. Vercel's official deployment guidance states that production-target builds ordinarily auto-assign domains; the connected REST create-deployment tool has no per-deploy `--skip-domain` option. For fail-safe staging, the operator used a project-scoped `update_project` request to set `autoAssignCustomDomains: false` **before** requesting `target: production`, then verified the existing READY deployment retained both original aliases. Vercel accepted the settings update; the project information connector did not expose a readable copy of that specific flag. **Leave automatic domain assignment disabled** until the owner authorizes deliberate promotion and a careful restoration decision.

- Staged production-target deployment **`dpl_9KjRha2Rfn2JVuny4utVtpAUQpFB`**, URL `https://pro-papa-mcp-staging-o97t9c7d2-fpspro0421-1213.vercel.app`.
- Final Vercel deployment readback: **READY**, `target=production`, `alias=[]`. An initial in-progress API response listed a tentative team alias; subsequent authoritative READY readback confirmed **no alias was assigned**. A cancellation request made while verifying this returned `deployment_not_canceled` because the deployment was already complete. The candidate was **not** promoted.
- Exactly **17 allowlisted runtime files** were supplied from pinned GitHub commit `36448b56e6b5e0ff049fa2068d5f3b586702403c`. The provider build log confirms `Downloading 17 deployment files`, `Build Completed in /vercel/output`, and `Deployment completed`. The provider source file tree contains 17 entries; all 17 `uid` SHA-1 IDs match the separately source-verified preview's 17 IDs, which matched the pinned Git files. This is uploaded source identity, **not compiled Lambda byte attestation**.
- The old READY deployment **`dpl_y6WTePYdcAynSsDw1ozGPnUjQsQA`** still holds the original aliases **`pro-papa-mcp-staging.vercel.app`** and **`pro-papa-mcp-staging-fpspro0421-1213.vercel.app`**. Vercel API hostname resolution confirmed both old aliases resolve to that old deployment. An Auth0-connected MCP `math.sum([2,3,5])` call on the stable existing endpoint returned `10`, status `completed`, trace `released`.
- Real credential-free HTTPS smoke [run 41743087958](https://github.com/Papa3445/Pro-Papa/actions/runs/41743087958) passed from GitHub Actions: staged candidate `/.well-known/oauth-protected-resource` **HTTP 200** with correct issuer/resource/scope; staged candidate `/mcp` and `/api/mcp` **HTTP 404** (strict canonical-host restriction); old stable `GET /mcp` **HTTP 405**. The preview candidate also remained unchanged. No credentials, destructive requests, or Netlify traffic were used.
- [Exact-head PR verification](https://github.com/Papa3445/Pro-Papa/actions/runs/41743096774) passed on the subsequent workflow-only commit. The deployment remains pinned to the earlier `36448...` runtime commit; later PR commits added documentation and tests, not a candidate-redeployment.
- The staging project's previously verified 30 requests/minute/IP WAF rule remains active. No Auth0 application, ChatGPT connection, original Netlify service, billing plan, stable-domain routing, or protected main branch was altered during this deployment.

**Next release boundary:** A staged READY production-target candidate now exists and can be promoted without a preview-to-production rebuild. **Do not promote or roll back without separate owner authorization.** The actual new-version authenticated MCP tool call cannot be proven via the unaliased deployment URL because the application correctly rejects noncanonical hostnames. A planned, reversible promotion to the *staging* canonical domain, signed positive execution smoke, and explicit rollback to the preserved old deployment must be independently reviewed and separately approved. After any rollback, inspect Vercel's domain auto-assignment state; do not assume it has been restored.

## Operator decision

The historical READY deployment and two new candidates (preview and staged production-target) have provider-verified source identity. The staged production-target candidate `dpl_9KjRha2Rfn2JVuny4utVtpAUQpFB` is **READY and unaliased**, and both old canonical staging aliases remain on `dpl_y6WTePYdcAynSsDw1ozGPnUjQsQA`. Production-domain auto-assignment is deliberately disabled pending explicit approval. New candidate's Auth0 positive `tools/call` on the canonical hostname, **actual promotion and rollback health exercise**, and independent new-head review are still unverified. Do not merge PR #64 or change the existing ChatGPT connection based solely on source checks and HTTP 200/404 smoke.
