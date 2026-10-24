# PP-0007 — explicit read-only ChatGPT-facing MCP bridge

This scoped bridge exposes one **standard MCP tool** that explicitly invokes the previously verified Pro-Papa Node reference host. It is a **host-controlled tool result**, not an automatic hook into every ChatGPT Project message, a model-reasoning attestation, or a complete universal AI operator.

## Capability and authority

- Endpoint: **stateless Streamable HTTP** `POST /mcp`. Supports MCP `initialize`, `ping`, `tools/list`, `tools/call` and accepted notifications. Minimal JSON responses; `GET /mcp` returns 405 because server-side SSE is unsupported. The bridge is intentionally small, implements the documented 2025-06-18 and 2025-11-25 MCP flows, and does not yet claim interoperability certification from MCP Inspector or a real ChatGPT installation.
- Discovered tool: `pro_papa_execute_readonly` with exactly three allowlisted capabilities: `math.sum` (strict finite number list), `text.metrics` (local text counts), and `research` (metadata for **preapproved** GitHub repositories). No publishing, issue creation, shell, arbitrary code execution, automatic user-account access or Project-wide interception.
- Every valid invocation calls `createReferenceHost({traceMode:'enforced'})` with **server-controlled grants**, audit policy, and repository allowlist. Only `verifyReleasedExecution()` can yield `isError:false` and `structuredContent`; blocked calls yield `isError:true`, `execution:null` and no structured completed output.
- Observations identify only the explicit host invocation and checked output hash. `providerAuthenticated:false` remains explicit. GitHub receipts require a separately host-configured **private** audit store; the default no-audit math demonstration must not be passed off as an audited run.

## Run locally

Node.js 20+ in a trusted checkout. **No package dependency added.** The CLI requires a host-managed token of at least 32 characters even on loopback to avoid accidental unauthenticated tunneling.

```sh
# Put this in a protected runtime secret manager; do not commit or paste it in chat.
export PRO_PAPA_MCP_TOKEN="<host-managed-secret-at-least-32-characters>"
export PRO_PAPA_MCP_PORT=8787
npm run mcp:readonly
```

Server binds **127.0.0.1 only**. It never opens a public interface, even when environment variables are malicious. Use an HTTPS reverse proxy with authenticated access or a trusted Secure MCP Tunnel if connecting a ChatGPT custom MCP plugin. External connection and deployment have **not** occurred in this increment.

For a local protocol smoke check, send MCP JSON-RPC to `http://127.0.0.1:8787/mcp` with `Authorization: Bearer <secret>`, `Content-Type: application/json` and `Accept: application/json, text/event-stream`. Discover the tool through `tools/list`, then send:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pro_papa_execute_readonly",
    "arguments": {
      "objective": "Sum three numbers",
      "capability": "math.sum",
      "inputs": {"numbers": [2, 3, 5]}
    }
  }
}
```

Read-only repository metadata is disabled unless `PRO_PAPA_MCP_REPOSITORIES` is set to a comma-separated explicit list such as `Papa3445/Pro-Papa` on the host. No requester-controlled repository names expand that allowlist. If `PRO_PAPA_MCP_AUDIT_REQUIRED=true`, the host must also have `PRO_PAPA_AUDIT_REPO` configured as a verified private repository and appropriate GitHub credentials. Missing or simulated audits never yield successful execution. Do not enable public external effects through this bridge.

Optional trusted operator configuration:
`PRO_PAPA_MCP_HOSTNAMES` for HTTPS proxy Host values, and `PRO_PAPA_MCP_ORIGINS` for explicitly trusted browser origins. The default denies all cross-origin browser requests. The bridge rejects spoofed Host/Origin headers, oversized payloads, requests without accepted MCP headers, unrecognized tools and malformed JSON-RPC. Do not set a wildcard Origin or expose it without a hardened reverse proxy/tunnel, rate limiting, authentication, and independent security review.

## ChatGPT connection boundary

OpenAI documents **custom MCP servers** as a supported ChatGPT extension. Where the account/workspace permits, use ChatGPT **Plugins → Add custom MCP server**, supply an authenticated **HTTPS `/mcp` endpoint** or Secure MCP Tunnel, review the connection's permissions, and explicitly select the plugin or invoke its tool in a message. Eligibility, menus, and restrictions depend on plan and workspace; do not assume this account has creation/admin permissions.

**The model still selects tools.** Neither a custom plugin nor Project instructions can force every ordinary ChatGPT reply to pass through the bridge. The host releases or blocks **its tool result**; it does **not** control ChatGPT's native response rendering or prevent the model from answering without calling the tool. Stronger whole-turn guarantees require a separate model host/operator interface with exclusive authority over final-answer release.

Read current product guidance before configuring remote access:
- [OpenAI — Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [OpenAI — Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Model Context Protocol — Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)

## Acceptance boundary and testing

`npm run check` performs actual local HTTP integration tests using `127.0.0.1` sockets: initialization, read-only tool discovery, verified math/text handler dispatch, denied research, malformed arguments, unsupported protocol, invalid JSON, body size, no SSE GET, forged Origin/Host and bearer authentication. Tests cannot authenticate real ChatGPT calls or prove tool selection for an entire conversation.

The frozen 21-pair ChatGPT website study remains unchanged. PP-0007 stays **in_progress**, with fresh exact-head CI and independent PR review required before a scoped merge. A merged MCP bridge is a possible opt-in integration **component**, not PP-0007 closeout, actual deployment, or evidence of superior cross-domain user outcomes.
