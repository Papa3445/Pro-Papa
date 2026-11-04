# PP-0010 — opt-in PDF host release prototype

This is a separate Node.js host workflow, not a ChatGPT Project hook, production route, MCP permission change, or replacement for human review. The trusted caller configures enablement, an authorized producer callback, an authorized publisher callback and 1–8 exact visible-text checks. End-user requests cannot register capabilities, select a publisher, override checks or force release through run().

The gate copies real produced PDF bytes, binds their SHA-256 identity (optionally to preapproved expectedSha256), calls the existing reference host with artifact validation enabled and enforced tracing, verifies released execution, exact capability, provider, digest, byte length, and all required checks, and only then passes the bytes to the configured publisher. The publisher must independently read back the saved artifact and return matching sha256 and byteLength. Missing validators, forged audit-only claims, stale hashes, invalid PDFs, unsupported formats or untrusted overrides prevent publication. Responses omit document bytes and extracted text.

The PDF validator is deliberately limited to text-oriented classic-xref PDFs at most 32 KiB. Its mechanical checks do not establish appearance, accessibility, correctness, safety, malware freedom or subjective quality. A publisher that writes before failing can leave a side effect; the gate returns needs_reconciliation rather than falsely saying no release. Only a trusted external host can authenticate publisher readback, and this prototype does not authenticate it independently.

## Isolated live host scenario

Run: node --test tests/pp0010-pdf-release-workflow.test.mjs

The test uses a real in-process reference host and a self-contained PDF byte fixture; the positive path writes to a temporary file and reads back and hashes its bytes. Negative host tests deny missing text, disabled grants, mismatched hashes, invalid files, forged audit-only results, unavailable validators, replayed validation from another PDF and spoofed publication acknowledgments. Inspect the actual exact-head GitHub Actions result; this document does not substitute for running tests.

## Integration and remaining gates

This wrapper is not invoked by the deployed API, Netlify function, MCP transport, Vercel staging endpoint, or ChatGPT Project turns. Default enablement is false; no credentials, production settings, deployment, routing or billing are changed.

Before verifying PP-0010, obtain a separately authorized real external/native producer and publisher demonstration, exact-head successful CI, the required software-profile evidence, and genuinely independent authenticated GitHub review. Isolated host tests do not prove a production deployment.

One-shot behavior: each enabled gate instance permits one attempted validation/publication cycle. Concurrent calls and retries return already_attempted, including after uncertain external side effects. A trusted operator must explicitly create fresh authority for a new attempt after reconciliation.
