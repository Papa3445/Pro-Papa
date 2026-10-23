# PP-0007 — no-API-key ChatGPT baseline workflow

**Chosen path:** use a real ChatGPT conversation as the direct-assistant baseline, instead of the optional paid OpenAI Responses API collector. This path requires **no OpenAI API key and no model API purchase**. The comparison still requires real observations and independent review; it cannot be completed by simulated answers or by relabeling earlier unrelated host tests.

The fixture remains exactly the seven frozen canonical cases from `fixtures/pp0007-paired-trial-collection-template.json`, Git blob `aa07d8296ab8c4ad492ec02863bd4203bb90ead4`. Do not rewrite them to make Pro-Papa appear better. `canonicalTrial()` provides the same objective and serialized canonical inputs for both the API and manual baseline variants.

## Operator workflow — one case at a time

Use an **existing private directory outside the public repository**, controlled by your operating-system account, for prompts and transcripts.

1. Run explicit packet preparation. It invokes no AI service and writes a new mode-0600 file:

   ```sh
   node bin/pp0007-manual-chatgpt-baseline.mjs \
     --execute --prepare --case qa \
     --out /private/pp0007/qa-prompt.json
   ```

2. Open the packet locally, copy its **exactUserPrompt** into a *fresh standalone ChatGPT conversation*, and submit **without other instructions or changes to the canonical prompt**. Record the start/end time yourself if a reasonably comparable measurement is available. Note the model *if visible*, product UI, actual tool permissions, whether search was used, and any corrections. If no such information is reliably available, record **unknown**, not a guessed value. A model name typed by an operator is not a provider attestation.

3. Copy the **complete visible assistant answer** to a private UTF-8 text file such as `/private/pp0007/qa-response.txt`, and retain a private genuine chat export or conversation reference separately where possible. **Do not upload raw outputs, conversation URLs with private context, or credentials to the public Pro-Papa repository.** The script does not navigate ChatGPT or fetch a private chat automatically.

4. Record copied text, its actual local byte digest and truthful provenance:

   ```sh
   node bin/pp0007-manual-chatgpt-baseline.mjs \
     --execute --capture --case qa \
     --transcript /private/pp0007/qa-response.txt \
     --out /private/pp0007/qa-operator-capture.json
   ```

   This operation writes a **new** private mode-0600 file (no overwrites) with frozen prompt hashes, exact text, local transcript SHA-256, copy-time timestamp, and `source:"operator_copied_local_utf8_text_not_provider_attested"`. It does **not** attest that the answer came from ChatGPT or corresponds to the frozen prompt. It is **not** an automatic login, screenshot validation, credential verification or third-party provider receipt. The capture file always keeps grade, task success, corrections, token counts, measured latency, model and permissions **null** until independently supported.

5. Independently operate the [canonical host observation collector](PP0007-HOST-OBSERVATIONS.md) for that **same** case and compare its recorded output, permissions, request semantics and provenance. A prompt hash match establishes only shared inputs, not equally enabled tools. The existing host is deliberately limited: freeform Q&A, software, document and novel requests may be unsupported, while missing grants lead to denied states.

6. Repeat independently for `qa`, `research`, `software`, `document`, `data`, `planning`, and `novel`. Each case needs a new packet and a distinct captured response. Do not bundle seven prompts into a single model request and call them seven separate trials.

## Security and evidence limits

- The Node runner does **not** make outbound network calls or require any API key. The only external AI action is the separate, human-operated ChatGPT conversation.
- The transcript input must be a nonempty, regular, nonsymlink UTF-8 file, at most 256 KiB, outside the framework. The output must be a new absolute private file outside the framework. Invalid or missing transcript data is **validated before reserving the output**, so a failed prevalidation leaves no zero-byte output blocking a corrected retry. Disk write failures after reservation may still need operator inspection; no user-existing file is automatically deleted. A shared or compromised parent directory is outside the local filesystem trust model.
- A locally copied answer and its SHA-256 do not prove provider authenticity, model identity, answer quality or response latency. **No baseline result should be marked completed solely because a capture file exists.**
- Do not infer tokens or cost from text length. ChatGPT subscription access is not the same as pay-per-token API accounting, and this workflow makes no provider-reported token usage claim.
- Keep `fixtures/pp0007-paired-trial-collection-template.json` untouched and empty until separately supported real results and independent grades exist; preserve the original **2/7** freeform host observation and separate **4/4** structured pilot without conflation.
- An independent reviewer should check authentic private conversation records and full host outputs, issue substantive quality judgments by task, independently verify calculations and sources, and record actual corrections, elapsed time boundaries, tool permissions, and evidence limits. Public task evidence should contain only non-sensitive hashes and aggregate outcomes.

## Acceptance and final review

PP-0007 remains `in_progress`. The milestone requires all six domains plus novel/fallback, negative authorization/unavailable-tool and dishonest-receipt cases, genuine audit receipts where applicable, actual outcome quality/completion and measurable cost/overhead where available, reproducible source identity, exact-head CI and **new authenticated independent milestone review**. A no-key ChatGPT baseline can supply the direct-assistant arm without a paid API. It cannot supply unobserved results or guarantee Pro-Papa outperforms ChatGPT.

The optional [Responses API collector](PP0007-API-BASELINE.md) remains for separately authorized future work; it is **not required** for the no-key route. See the [matched-trial protocol](PP0007-PAIRED-TRIAL-PROTOCOL.md).
