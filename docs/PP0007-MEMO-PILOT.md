# PP-0007 — bounded in-memory memo pilot

This is **not a general-purpose document-writing AI**. The reference host's explicitly selected `memo.draft` capability formats **requester-provided** recipient, subject, purpose, 1–6 facts and 1–6 proposed actions as a text-only business memo. No source validation or independent recommendations are invented; text is marked `DRAFT — UNVERIFIED`. The host does **not** generate DOCX/PDF files, send email, post to GitHub or write a document to disk.

## Example request

```json
{
  "objective": "Draft a bounded project memo",
  "capability": "memo.draft",
  "inputs": {
    "to": "Project coordination team",
    "subject": "Weekly workstream kickoff",
    "purpose": "Align the team on next steps and known constraints.",
    "facts": ["The workstream has three proposed activities.", "Owners still require confirmation."],
    "actions": ["Assign owners to each activity.", "Review the draft with stakeholders."]
  }
}
```

The existing `document` capability remains unsupported without a separately authorized handler. `memo.draft` is declared `profile:document` and `effect:read`; it returns a local Node provenance marker. Known-field, size, sparse-array, line-break, C0/C1 and Unicode-direction checks prevent header/display control injection. The exact script and regression tests must receive real CI and independent PR review before merge.

**Benchmark integrity:** Original seven-case benchmark still reports **2/7** completions because it requested unstructured general document writing; this structured-input pilot is distinct. No direct-assistant paired baseline, LLM quality study, human-correction interactions, tokens or generalized result-quality comparison has been performed. PP-0007 must stay `in_progress`.
