# PP-0005 — Explicit request gateway

Pro-Papa's gateway is a **host-invoked JavaScript API** with a minimal JSON-stdin CLI. It does not intercept ChatGPT Projects, spawn an AI agent, dynamically install tools, execute arbitrary commands, or imply that an audit receipt proves answer quality. PP-0006 will provide a real multi-provider host integration.

## Runnable CLI (Node.js 20+)

From the Pro-Papa checkout:

    printf '%s\n' '{"objective":"Sum three numbers","capability":"math.sum","inputs":{"numbers":[2,3,5]}}' | node bin/gateway.mjs
    printf '%s\n' '{"objective":"Count these words","capability":"text.metrics"}' | npm run gateway

The CLI exposes two **read-only** built-in handlers: math.sum (finite numbers) and text.metrics (character and word counts). All other categories need an explicitly connected trusted host. Never pass sensitive request text via CLI arguments; request JSON arrives on stdin and is not written to the framework repository.

## Separate durable project

    node bin/pro-papa.mjs init --root /tmp/example-user-project --name "Private user project"
    export PRO_PAPA_GATEWAY_SECRET='a-long-secret-from-a-host-managed-vault'
    printf '%s\n' '{"id":"3aa4fdc9-3fd7-4ff2-a671-708c3f01eb57","objective":"Sum project values","capability":"math.sum","inputs":{"numbers":[4,8]}}' | node bin/gateway.mjs --durable --project /tmp/example-user-project

The host must supply a stable secret of at least 16 characters outside task JSON, and a UUID request ID stable across retries. The request becomes an entry in the **user project's** authoritative .pro-papa/tasks.json, never the Pro-Papa framework roadmap. The task stores a generic objective and HMAC-SHA-256 identity, not the original request, inputs, output or secret. Protect the host key; a digest is not proof against compromised writers.

The gateway reserves the request before executing its handler. Following a successful operation the task remains in_progress: genuine artifact, test, validation, adapter and independent review evidence are still required before formal closure. Duplicate successful requests return already_executed without tool rerun. Ambiguous execution needs manual reconciliation; a provider error may be retried only with host authorization for read-only capabilities. No exactly-once guarantee is made, and optimistic project locks can reject concurrent requests.

## Host-registered authenticated handlers

    import { runGateway } from './src/gateway.mjs';
    const outcome = await runGateway({
      request: { objective: 'Research a topic', capability: 'research' },
      host: {
        handlers: {
          research: async ({ objective }) => {
            const actual = await authorizedResearchProvider(objective);
            return { ok: true, output: actual.answer,
              provenance: { provider: 'trusted-host', operation: 'research',
                reference: actual.sourceId } };
          }
        },
        grants: ['research'],
      },
    });

The host owns the handlers and grants. User objectives, category hints, task metadata and retrieved content cannot register tools or grant permissions. The fixed capabilities are text.metrics, math.sum, general, research, software, document, data and operations. Keyword routing is only a suggestion; a missing handler may fall back to general solely when general is expressly authorized. Software, document and operations require additional approvedEffects permission. The host remains responsible for detailed authorization, especially for publishing, deletion, credentials, communications, finances and other external effects.

Successful handlers must provide an output and a provenance object containing a provider name and the matching capability operation. Such provenance is still a **host assertion**, not independent proof of provider execution. Malformed provenance returns unverified_execution, with no false completion; provider exception details are not returned.

## Optional private receipt

With a host-managed GitHub token and PRO_PAPA_AUDIT_REPO configured, add --audit to the CLI to call the PP-0004 issueUsageReceipt function. It reads live framework instructions and writes/readbacks a minimal record in a separate private GitHub repository. Execution and audit are independently reported: a failed receipt never implies the task was unexecuted or safe to repeat, and a confirmed receipt does not prove the answer was correct. Third-party hosts may inject their own receiptIssuer only as a trusted operation; a URL supplied by user text is never accepted as receipt evidence.

## Current limitations and next milestone

This delivers a bounded executable router, CLI, retry/permission checks and durable state integration, **not** a general-purpose LLM, remote deployment, real multi-provider execution host, automatic ChatGPT Project interception, or independent output-quality verifier. PP-0006 is the planned host integration milestone.
