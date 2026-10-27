# PP-0008 — opt-in read-only PDF artifact validation (candidate)

## Purpose and scope

This adds an explicit `artifact.validate` capability to the existing `pro_papa_execute_readonly` MCP tool. It checks **actual supplied PDF bytes**, rather than pretending a description, file name, MIME label or upload link is the document. It neither generates PDFs nor accesses a person's ChatGPT uploads, local filesystem or arbitrary URLs. A native creation tool must create and hand the bytes to the MCP caller separately.

**Default: disabled.** The operator must configure `PRO_PAPA_MCP_ARTIFACT_VALIDATION=true` for the local bridge or Netlify Function (or pass `artifactValidationEnabled:true` in an authorized server factory). An unset setting or `false` keeps it absent from tool discovery and denies invocations. Invalid environment configuration fails closed. On a warm Netlify instance, a setting change invalidates the cached handler; no user PDF or bearer is cached.

## Request and result

An authorized MCP `tools/call` request uses:

```json
{
  "name": "pro_papa_execute_readonly",
  "arguments": {
    "objective": "Check the previously created PDF",
    "capability": "artifact.validate",
    "inputs": {
      "authorization": "validate_supplied_bytes_only",
      "format": "application/pdf",
      "dataBase64": "<BASE64_OF_ACTUAL_PDF_BYTES>",
      "mustContain": ["Required document text"]
    }
  }
}
```

The trusted server controls the capability grant. The explicit per-call declaration is an additional opt-in, **not** an authenticated proof of which end user consented: MCP host authentication and transport access control must establish that separately. The request passes through existing bearer/OAuth verification, host/Origin rules, total 65,536-byte HTTP body cap, active-eight per-instance concurrency limit, and the enforced reference-host release gate. The bridge still does not provide a distributed concurrency quota.

For a supported PDF with every required check matched, released `structuredContent.execution.output` contains only:

- `format`, `byteLength`, `sha256` of exact decoded PDF bytes;
- `pageCount` (1–20), `extractableCharacters`, `requiredChecks`, `matchedChecks`;
- `mechanicalOnly:true`.

No extracted paragraph, caller-supplied expected string, PDF byte array, user name or secret is returned in a successful validation result. Each required phrase must occur **within a single page**; text spliced across a page boundary does not pass. Missing expected text causes a blocked response, with no released structured result. The SHA is an identity digest, not confidentiality for predictable PDFs, and validators cannot guarantee that logs in upstream hosts never capture submitted payloads; configure host ingress logging accordingly.

## Deliberate limited PDF support

The built-in parser uses only `node:crypto` and `node:zlib`. It accepts small text-based **PDF 1.0–1.7 classic-xref** documents with direct stream lengths, normal page trees and uncompressed, FlateDecode, or the ReportLab-style ASCII85Decode then FlateDecode content stream. It evaluates ASCII text from simple PDF `BT...ET` with `Tj` and `TJ` operators, including escaped literal strings. It verifies xref offsets, referenced object IDs, actual page parent references, page-tree counts, extraction, stream length and the final end marker.

It **rejects** malformed offsets and references, mismatched page counts, unextractable pages, PDFs with incremental trailers, xref/object streams, encryption, embedded/interactive content, unsupported encodings, filters and complex text representations. Valid PDFs using those features are **unsupported**, not verified or safe. A 32 KiB decoded-byte cap and 256 KiB decompressed-stream cap bound the analysis. No full renderer comparison, signatures, font embedding audit, semantic evaluation, layout assessment, accessibility certification or antivirus claim is made. Text extractability is not proof that the text is visually legible.

One synthetic fixture constructs a genuine, self-contained one- and two-page PDF with real xref offsets and optionally Flate-compressed text. A separate reproducible two-page PDF was actually generated using ReportLab Canvas with invariant metadata and ASCII85/Flate stream filters (1862 bytes; SHA-256 `021193766742a4460a506df24ed07e95d4b5ccf6fa4cfe88af3e683195af7df9`) and is mechanically validated by an isolated MCP HTTP Request/Response adapter in a dedicated test. It submits the bytes through the reference host and HTTPS MCP Request/Response adapter. Tests also cover forged grants, missing per-call authorization, invalid base64, oversized payloads, spoofed or broken PDFs, parent-tree mismatches, interactive page annotations, cross-page text spoofing, missing content, denial, no raw text leakage and checked trace release.

**Important remaining PP-0008 acceptance gap:** the ReportLab fixture and isolated MCP test do not prove a separate ChatGPT-native user-facing PDF creation followed by a real OAuth-connected production MCP validation. That paired host demonstration, full exact-head CI and independent GitHub review must be separately observed before marking PP-0008 verified. Do not claim a production feature deployment until a separately authorized release and exact published source SHA are confirmed.

## Privacy and security notes

The design is deliberately restrictive rather than a general PDF reader. Avoid sending private PDF bytes to an untrusted MCP server. The validator runs in memory without a filesystem or network access path, returns deterministic metadata, and does not send the PDF to GitHub or an audit repository. The request bytes may still traverse provider infrastructure; do not publish them as fixtures. Receipt creation remains a separately authorized operation. This source-level gate cannot intercept ChatGPT replies outside explicit selected tool calls.
