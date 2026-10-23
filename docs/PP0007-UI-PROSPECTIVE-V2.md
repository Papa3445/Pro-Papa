# PP-0007 — prospective ChatGPT website comparison (not yet run)

## Why this study is separate

The independent, nonblinded 2026-10-23 reassessment inspected 35 operator screenshots and reran the available Pro-Papa2 parser, passing ten Node test groups and 12,000 date-oracle cases. Its retrospective **18/21 regular versus 21/21 project** grades are descriptive, not controlled evidence of superiority. The baseline parser ZIP is missing, so symmetric code validation remains impossible. Earlier PP-0007 **native reference-host** tests are a separate experiment.

The source of truth for this **future-only, unexecuted** study is [the versioned JSON contract](../fixtures/pp0007-ui-v2-contract.json). The original immutable seven-case fixture remains at Git blob `aa07d8296ab8c4ad492ec02863bd4203bb90ead4`; its original objectives, capability names, structured inputs, and prior outcomes **are not changed**. The new rubric must never be represented as predeclared for any previously collected screenshots.

## Exactly reproducible participant prompts

Both arms paste the corresponding `caseDefinitions[].submittedPrompt` **verbatim** into a fresh ChatGPT website conversation. Render the exact text as `canonicalObjective` when canonical inputs are null; otherwise concatenate the objective, one literal newline, the phrase `Canonical inputs (JSON): `, and compact `JSON.stringify(canonicalInputs)` retaining the original fixture's key order. Do not add custom instructions, different repository addresses, examples, extra context, a trailing newline, or a Pro-Papa-only sentence to either participant prompt. The source framework contract remains its own project instruction and is **not** pasted into the user prompt.

Research and data have the extra canonical-input JSON line **in both arms**; the five remaining cases have objective-only prompts. Save **actual sent prompt text or provider transcript and SHA-256** privately with every observation. Missing prompt provenance or any mismatch is an explicit prompt-parity failure and cannot be silently promoted to a valid paired outcome.

## Preassigned order with minimum possible imbalance

Each of the seven tasks has three paired repetitions, and every repetition has one regular and one project conversation. The order is frozen per case in `orderByCase`, not globally. First four cases alternate **regular, project, regular** as first arm; last three alternate **project, regular, project**. Across all 21 paired repetitions, **regular goes first 11 times; project goes first 10**, the minimum possible difference for an odd number of pairs. Preassignment is deterministic, **not randomization**; operator time-of-day and repetition effects remain possible and must be reported. Preserve the 21 order assignments and do not reassign based on observed responses.

## Scoring and missing evidence

Use `rubric.grades` (0–3) on genuinely new trials only. Target **two independent reviewers**, preferably blinded to the arm wherever feasible. Both must provide raw integer scores and evidence-backed rationales. If scores agree, accept the common grade. If they disagree, obtain a **third independent score**, and take the median of all three; before the third exists the final grade remains **null**. Report any ungraded observations and why; never replace missing grades, tool calls, timing, or tokens with zero.

A software output whose ZIP, source or common independently run tests are missing **cannot earn verified code correctness or grade 3** from claims such as "32 tests passed". If visible substantive content exists, the code case may receive at most 2 with an explicit justification; if it cannot be assessed, keep its grade null. For non-software cases, grade 3 requires the independently inspectable artifact or checkable answer, not a footer alone. Keep one-turn task completion a separate `true/false/null` observation; asking for clarification can be appropriate even if the original objective remains incomplete.

Aggregate only grade-resolved pairs with sufficient evidence, report exclusions and tool-grant parity, and never treat these seven prompts or 21 repeated pairs as proof of causal superiority. An underspecified novel question may appropriately elicit either a clearly labeled illustrative example or one clarification; substantive completion and appropriateness are different outcomes.

## Evidence, privacy and operational boundaries

Keep the user's **mandatory per-message live GitHub use policy unchanged** for the project arm. A response footer or pinned link does not independently authenticate other-chat connector operations. Where a receipt exists, verify its actual private-store commit, content and readback. A private receipt proves provider-visible GitHub operations, not model reasoning or that the answer used a fact. Tool/permission differences, context and memory, specific models, wall time, retries, corrections, source provenance and token counts remain `null` until genuinely measured; do not compare local Node host call timing to ChatGPT UI elapsed work labels.

**Do not start the new study** until the owner has a reliable private collection method for complete prompts, full transcripts, both code ZIPs and timing. Do not publish user screenshots, transcripts, private identifiers or software payloads to public GitHub. This versioned contract by itself performs no ChatGPT calls, certifies no receipts, improves no hosted integration, and does not complete PP-0007.

Submit any implementation change via scoped PR with passing **exact-head CI** and authenticated independent approval before merging. PP-0007 stays `in_progress`.
