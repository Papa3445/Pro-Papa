# PP-0006 — Runnable reference host and enforced audit gate

The reference host is a **Node.js JSON-stdin process**, not an extension or interceptor of native ChatGPT Projects. It accepts submitted request JSON, passes it to PP-0005's gateway, invokes only **host-configured** tools, and returns a structured JSON outcome. A human, another application, CI runner or explicitly connected agent can call it. Native ChatGPT Project turns are **not** automatically routed through it.

## Quick start (Node.js 20+)

From the repository checkout:

```sh
printf '%s\n' '{"objective":"Add these values","capability":"math.sum","inputs":{"numbers":[2,3,5]}}' | npm run reference-host
```

Expected result: `status:"completed"`, `execution.output.total:10`, and `execution.provenance.provider:"local-node"`.

To query real public GitHub repository metadata using an allowlisted, read-only HTTPS API:

```sh
printf '%s\n' '{"objective":"Research repository metadata","capability":"research","inputs":{"repository":"Papa3445/Pro-Papa"}}' | node bin/reference-host.mjs --github-read --github-repo Papa3445/Pro-Papa
```

The host restricts its GitHub API calls to `https://api.github.com/repos/OWNER/REPO`, with a repository specified **by host-controlled allowlist** and a fixed GET method. A supplied arbitrary URL is never fetched. An optional `GITHUB_TOKEN` provides provider authentication without logging credentials. Without `--github-read`, the research capability is denied; unsupported tools are not improvised.

## Durable execution

Initialize a **different** project, not the framework's own project:

```sh
node bin/pro-papa.mjs init --root /tmp/my-pro-papa-work --name "Host work"
export PRO_PAPA_GATEWAY_SECRET='host-managed-secret-from-a-vault'
printf '%s\n' '{"id":"8a0dc3bd-e94f-427a-a277-aaabf621047b","objective":"Add project values","capability":"math.sum","inputs":{"numbers":[1,2]}}' | node bin/reference-host.mjs --durable --project /tmp/my-pro-papa-work
```

A host-managed stable UUID/secret associates retries with the same task. The gateway reserves the task before a handler runs. Completed retries are deduplicated, read-only failures require authorized retry, and **potentially applied writes remain ambiguous and must be reconciled**, not automatically retried. Within one process the reference host serializes per-project requests; across processes gateway filesystem locks and optimistic revisions prevent silent parallel writes, but do not provide an exactly-once distributed guarantee. Sensitive objective text and handler inputs are not persisted in the task ledger.

## Private audit: fail closed before execution

Set `GITHUB_TOKEN` in a host-managed environment with source read and **private audit repository write** permissions, and `PRO_PAPA_AUDIT_REPO=OWNER/PRIVATE_AUDIT_REPO`.

Add `--audit-required` to any of the commands above. This runs the real PP-0004 issuer **before** reserving durable state or invoking a tool. It pins and reads live GitHub source instructions, then writes and reads back a minimal receipt at an immutable private commit. If verification, privacy, authorization or provider calls fail, the result is `status:"audit_failed"`, `audit.status:"failed"`, and `execution:null`: **no handler runs, and no durable work is reserved**. This fail-closed response does **not** prove a receipt write was rolled back if the provider failed after PUT. The receipt omits prompts, user inputs and secrets. A verified receipt proves the GitHub operation, not result accuracy. The production host still requires an actual end-to-end `--audit-required` run with credential-scoped access to the private audit repository before full PP-0006 acceptance is claimed.

The `createReferenceHost` Node API uses the native Node `globalThis.fetch` for production private-audit issuance; an injected audit HTTP transport is **rejected** unless `auditTransport:'simulation'` is explicitly set. Simulation runs the real PP-0004 protocol against a mock but returns `audit_unverified` / `audit.status:'simulated'`, **without dispatching a handler**. Simulated transcripts can never produce provider-backed `confirmed`. A real private-repository smoke test requires authorized credentials and an accessible private store, never committed to CI or the repository.

## Explicit external write approval

The optional Github issue-creation handler operates under `operations` and is disabled unless **all** host options are supplied: a repository allowlist, `--durable` with a separate project, a host-managed `GITHUB_TOKEN`, and both `--approve-create-issue-id UUID` and `--issue-repository OWNER/REPO`. The approved UUID, exact repository, action **and full title/body payload SHA-256** must match. Supply `--issue-payload-sha256 64_HEX_DIGEST` from an independently reviewed authorization of the exact issue content; compute it with the exported `issueApprovalDigest({requestId,repository,title,body})` helper using a trusted host context (not user-supplied request data as an authority). An ID and repository alone do not authorize arbitrary issue content. An authorized mutation uses a fixed GitHub `POST /repos/OWNER/REPO/issues` endpoint and returns only a validated issue number/URL. No generic shell tool, filesystem mutation, credential exposure, search-driven tool installation or open-ended arbitrary API access is registered. **Creating an issue is a real external action**, so invoke it only with authorized user consent. Network errors after dispatch are ambiguous: GitHub might have created the issue even when the host cannot verify it.

## Security and limitations

- Host configuration (tool grants, credentials, repository allowlists, effects and audit mode) comes from trusted command-line/env context, **never** JSON input.
- The original gateway validates detached JSON output and plain provenance and refuses false completion from getters, nonfinite values, mutable `toJSON`, missing metadata and other unsupported structures.
- Only the fixed `math.sum`, `text.metrics`, `research` (GitHub repo metadata), and approved `operations` (GitHub issue creation) handlers are implemented. An arbitrary objective requiring another capability returns `unsupported` or `denied`, not a fake result.
- `npm run check` and the full Node test suite exercise permissions, real handler code, mocked GitHub HTTP provider and audit operations, durable retries, concurrent requests, invalid receipts and adverse write outcomes. Mock tests alone are not a production multi-account smoke test.
- The API uses explicitly bounded network paths and input limits but no tenant isolation/authentication server. CLI users must separately secure their process, credentials, project directory, and subprocess invocation.
- There is no native ChatGPT Project turn interception, general-purpose LLM, deployed web service, background scheduler, or independently authenticated third-party answer-quality verifier.

This is a reference **executable path** for external hosts that explicitly invoke it; it does not enforce audits on messages sent only to ChatGPT.
