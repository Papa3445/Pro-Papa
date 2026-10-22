# PP-0007 — opt-in single-case API baseline collector (not an executed benchmark)

This runner adds a *way to collect* one authentic model API response. It is not an LLM inside the Pro-Papa host, not an automatic ChatGPT connector, not a direct **ChatGPT UI** baseline, and not a PP-0007 readiness or quality finding. The seven-case blank template and historical 2/7 and 4/4 results are unchanged.

## Required deliberate operator action

Set `OPENAI_API_KEY` securely in the executing host (never paste it into a prompt, commit it or put it in arguments). The chosen model must actually be enabled in that API account. Choose a private existing directory outside the public repository; output is a *new* mode-0600 file and is never overwritten. One invocation is **one** potentially billable API request, not a batch or an auto-retry:

```bash
node bin/pp0007-api-baseline.mjs \
  --execute --case qa --model MODEL_ID \
  --out /private/pp0007/qa-observation.json
```

Without `--execute`, an available credential, and a fully specified case, model and absolute output path, no call occurs. Only the fixed HTTPS `POST https://api.openai.com/v1/responses` endpoint is used, with `store:false`, `tools:[]`, a bounded output token limit and timeout. The caller chooses the model; no default model or broad unrestricted account permissions are implied. The seven canonical objectives and inputs are anchored to PR #15's exact Git blob, not caller-editable prompt files. Each submitted input contains the unchanged objective plus the canonical JSON inputs, if any. Requesting the next case requires a **separate explicit invocation**; ambiguous network failure is not retried.

The private local file records the requested model **separately** from the returned `actualModel`: an exact match has `modelIdentityStatus:"exact"`, and a calendar-valid dated snapshot formed from the exact requested alias (for example `gpt-4o-mini` → `gpt-4o-mini-2024-07-18`) has `"dated_snapshot"`. An unrelated model, prefix-overlap or malformed snapshot date is `"unverified"` and **cannot count as completed**, even when a response ID exists. This is a narrowly scoped identity policy, not cryptographic verification of a model.

Provider lifecycle status is separate from the outcome grade: HTTP-200 `incomplete`, `failed`, `cancelled`, `queued` and `in_progress` Responses preserve valid response IDs, returned model names and billed token usage when reported, but they **never** count as completed tasks. An incomplete response caused by `max_output_tokens` is a known unsuccessful provider state, not an unknown network outcome. A completed refusal remains `refused`; unexpected content or unknown network/HTTP behavior remains `outcome_ambiguous`. The local record leaves `taskSuccess`, `qualityGrade`, correction counts and private usage receipts **null** in every case. Even a completed text response is **not** independently quality-graded user-task completion. stdout only reports minimal status; exception/credential contents are not logged.

## Evidence limits

Simulated injectable HTTP clients are reserved for negative tests and always labeled `simulated_transport`; they cannot be used in `native` mode. Real TLS API responses are not independently re-fetched or cryptographically signed here. A response ID alone does not independently authenticate a result. This version does not invoke a live API without an authorized operator-provided key and does not produce any baseline score or model-vs-host conclusion.

After an authorized real call, an independent grader must inspect the private raw file, source fixture identity and provider account evidence, then run the *identical underlying task* through Pro-Papa's host with comparable declared tools and measure correction, latency, actual output quality and token use where available. OpenAI API text-only inference with no tools is not the same product as the ChatGPT UI; any comparison must state that difference. Never upload private raw model outputs to the public Pro-Papa repository. A separate, newly reviewed study is needed for fair multi-turn or tool-enabled cases.

Reference: [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create).
