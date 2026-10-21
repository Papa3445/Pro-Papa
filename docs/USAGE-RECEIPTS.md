# PP-0004 — GitHub usage receipts

## Purpose

**Measure verified GitHub operations, not hidden reasoning.** A receipt proves that an authorized host read the *current source repository* and wrote a minimal record to a **different private GitHub repository**, then read back the exact saved bytes from the resulting Git commit. The receipt does not establish whether the model used the data to form an answer.

Pro-Papa v0.1 does not automatically intercept ChatGPT turns. The host must explicitly run this command or an equivalent verified GitHub-connector transaction; a Project instruction is guidance, not enforced orchestration.

## One-time configuration

1. In GitHub, create a **private** repository named `Pro-Papa-Audit` (or choose a separate private repository). Initialize its default branch. Do **not** use the public `Papa3445/Pro-Papa` repository as the store.
2. Provide a **host-managed** `GITHUB_TOKEN` with read access to `Papa3445/Pro-Papa` and Contents read/write access to the private audit repository. The token must not be committed, pasted into ChatGPT messages, or logged.
3. Grant your AI host/connector permission to access this private audit repository. Ensure branch rules permit receipt writes by the authorized identity; changes should be limited to that identity.
4. Set `PRO_PAPA_AUDIT_REPO=YOUR_ACCOUNT/Pro-Papa-Audit`. Optionally set `PRO_PAPA_SOURCE_REPO` for an authorized fork.

Run from the Pro-Papa checkout, using Node.js 20+:

```bash
node bin/pro-papa.mjs usage-receipt
# or explicitly select source, audit store, and branch:
node bin/pro-papa.mjs usage-receipt \
  --source Papa3445/Pro-Papa \
  --store YOUR_ACCOUNT/Pro-Papa-Audit \
  --ref main
```

A successful command returns `status: confirmed`, the exact source commit and consulted blob IDs, `receiptCommit`, and `receiptUrl` pointing to the stored JSON under `usage-receipts/YYYY/MM/<uuid>.json`. The command checks store visibility before writing and after readback, and rejects observed public stores, identity/byte mismatches, and API failures. These GitHub calls are **not atomic**: a repository can become public while a PUT is executing, and a failed operation may have already committed a receipt. Prevent visibility changes using repository administration; never assume failure implies no write.

## Receipt fields

- Generated receipt ID and recorded timestamp.
- Framework source repository and immutable commit SHA.
- Exact paths read (`AGENTS.md`, `.pro-papa/profiles.json`) and verified Git blob SHAs.
- Operation classification `read-framework-instructions`.
- A limitations field stating that the record does **not** prove internal reasoning.

By design it **does not** record prompt text, conversation identifiers, other user files, or the response. Without a conversation ID this is a receipt per explicit operation, not an independently verifiable mapping to a specific ChatGPT message. Embed the **actual returned receipt link in that response** to make an explicit user-visible association.

## Recommended universal host workflow

1. For an ordinary request, determine whether Pro-Papa's full operating rules would materially help. If a receipt is requested or Pro-Papa was used, invoke the real GitHub read-and-receipt flow using the connected host tools, prior to claiming repository usage.
2. Perform the user's work using actual tools, domain evidence and your own reasoning.
3. Finish with exactly the grounded status:

   - `GitHub: Confirmed used — [real private receipt URL]` **only** after successful provider write **and readback**.
   - `GitHub: Accessed; no receipt` when live GitHub access succeeded but no persisted receipt exists.
   - `GitHub: Attempted but unavailable` if the requested access or receipt operation failed.
   - `GitHub: Not used` when no GitHub access occurred in the request.

4. Do not retroactively manufacture receipts for prior conversations. A private receipt link may only be openable by authorized users.

## Scope and verification

Tests in `tests/usage-receipts.test.mjs` mock all API operations and challenge a private-store write/readback, public-store rejection, invalid Git identity, malformed selectors, bad clock/UUID, denied writes and tampered readback. Passing mock tests are **not a production private-repository smoke test**. Configure a private store and execute the command in an authorized host for a genuine receipt.

**Important:** This is a library/CLI integration point, *not* a hosted server, hosted app, GitHub Action that runs on ChatGPT messages, or guarantee of always-on interception. A future supported host gateway could require a receipt before marking work complete; that's a separate integration requiring host/application support.

## Copyable ChatGPT Project instruction

See [universal operator](../prompts/universal-operator.md) for a concise project prompt that requires honest, per-response GitHub usage statuses and uses persisted receipts when an authorized private audit store is available. This prompt cannot enforce tool calls when the ChatGPT host does not support them.

## Privacy, receipt integrity, and remaining limits

The command rechecks private-store identity and default branch immediately before the receipt PUT and after the commit-pinned readback. A visibility change observed by the checks fails closed, **but does not undo any write**. Metadata lookups and GitHub Contents writes are non-atomic and provider metadata may be cached: there is no absolute confidentiality guarantee if administrators can change repository visibility concurrently. Keep visibility permissions restricted. A provider or authorized audit-repo writer with sufficient privileges may forge records.

Receipt content is verified byte-for-byte and by computing the Git blob SHA of the actual payload; the SHA must agree with the write response and readback metadata. Timestamps use calendar-valid, canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`. Neither establishes AI reasoning or an automatically enforced ChatGPT hook.
