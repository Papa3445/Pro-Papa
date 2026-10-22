# PP-0007 — separate structured reference-host outcome measurements

## Relationship to the original benchmark

This is a **new secondary study**, not a revision of the original seven freeform user-task fixtures. The original canonical `bin/benchmark-pp0007.mjs` and reports remain unchanged at **2/7 user tasks actually completed**. The new opt-in, explicit-input handlers operate at narrower scope, and must not be presented as responses to the original unstructured requests.

`node bin/benchmark-structured-pp0007.mjs` executes four real local host requests: numeric sum, structured Monday week, memo formatting from supplied facts/actions, and a fixed generated ISO-date JavaScript module. The software test dynamically imports the generated fixed code and checks valid/invalid dates. The memo test verifies the unverified template and exact provided content—not expert-quality writing. The scheduling test checks ordered dependencies and explicit UTC days—not resource management. Each execution reports actual status, provenance, audit status, host elapsed milliseconds, and **mechanical validation only**.

Five separate negative host requests challenge freeform Q&A, novel reasoning, arbitrary software authoring, unapproved GitHub issue publishing, and an injected memo publication action. The benchmark asserts expected fail-closed statuses. These deliberately refused requests are never counted as completed user outcomes.

## What is measured and what is not

- **Measured within Node**: local host elapsed milliseconds, host request counts, actual returned outputs/statuses, provider identity, mechanical case validations, and negative outcomes. Timings depend on the CI runner and include no human input or provider LLM latency.
- **No real external provider requests here**: `githubResearch:false`, `auditMode:'off'`, and no external effects granted. Local host count is **not** token overhead. Real GitHub metadata reads and authentic private-store receipt reads are separately observed under the older benchmark and PP-0004 workflows.
- **No per-pilot audit receipts**; audit status is explicitly `not_requested`. The separate conversation-level usage receipts do not substitute for these.
- **No paired direct-assistant baseline**: neither a direct model call nor tokenizer, LLM response quality judge, actual user-correction count, or tool-usage cost baseline is available through this local host. These fields are `null` and the report prohibits a superiority claim.
- **No general-readiness claim**: quick Q&A, open-ended research synthesis, novel reasoning, arbitrary programming or file-exporting remain outside these four handlers. A 4/4 structured pilot success rate is not a 4/7 or 6/7 user-task rate.

## Reproduction and provider evidence

```bash
node bin/benchmark-structured-pp0007.mjs
node --test tests/benchmark-structured-pp0007.test.mjs
npm run check
```

The new test emits exactly one machine-readable `PP0007_STRUCTURED_REPORT_JSON=` line during provider CI. A later evidence commit may archive this output with runner/source SHA and a real digest; a newly changed final head must have its own passing pull-request CI. Reviewer should check the original reports remain byte-identical, the generated-code import has no user-source interpolation, the output quality claim is bounded to mechanical checks, and the new study is not labeled as a direct-LLM baseline.

PP-0007's original acceptance conditions remain intact and **in progress** until six representative real requests, provider/evidence integrity, paired baseline quality/corrections/overhead comparisons, and independent review are genuinely satisfied.

## Provider observation (initial implementation head)

Live [GitHub Actions run 39722383548](https://github.com/Papa3445/Pro-Papa/actions/runs/39722383548), job 119638570920, at source SHA `7a13a89305e279f41433e20fb33c5c4d4d8cff76` ran **156/156 passing tests** and emitted machine-readable `PP0007_STRUCTURED_REPORT_JSON=` in its real job log. The independently inspectable parsed output, source git blob and SHA-256, runner identity and scope disclaimers are saved in `.pro-papa/evidence/PP-0007/structured-local-observation.json`. It is a historical source-head result; following this evidence commit, run new exact-head CI. Four explicitly structured mechanical completions and five safe refusals are **not** a four-of-seven general-task improvement; no direct assistant baseline, human-correction observations, LLM tokens or per-pilot receipts were measured.
