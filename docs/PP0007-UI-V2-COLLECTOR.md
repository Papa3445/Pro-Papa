# PP-0007 — private collector for prospective website study v2

This is a **collection aid**, not an executed study. The frozen seven-case/21-pair (42 separate conversations) prospective study is specified in [the v2 contract](../fixtures/pp0007-ui-v2-contract.json). The older frozen canonical fixture and earlier retrospective screenshots are **not modified**. This helper cannot navigate ChatGPT, establish provider identity, infer elapsed time or run tests on claimed ZIP files.

## Operating steps (one observation at a time)

Create a private directory **outside the public framework checkout**, owned by the current OS account and inaccessible to group/other users (POSIX directory mode 0700); store full prompts, transcripts, screenshots and runnable source ZIPs there, not in a public repository.

1. Follow the fixed `orderByCase` in the study contract. For example, `qa` repetition 1 begins with `regular` and then `project`. For each slot, generate its **new, exclusive** prompt packet:

   ```sh
   node bin/pp0007-ui-v2-collector.mjs --execute --prepare \
     --case qa --rep 1 --arm regular \
     --out /private/pp0007-v2/qa-r1-regular-prompt.json
   ```

2. In a **fresh** ChatGPT website conversation for the designated arm, paste `exactUserPrompt` verbatim (no edits, no Project-only text). Keep Pro-Papa2's mandatory Project GitHub-use policy unchanged. Preserve the **actual submitted user prompt** as a byte-exact UTF-8 private file `sent.txt`; save the complete visible response separately as `response.txt`. Retain original screenshots/provider export and code ZIPs privately where available, and record real operator timings and tool grants independently.
3. Capture a local copy with **both** prompt parity and response integrity hashes:

   ```sh
   node bin/pp0007-ui-v2-collector.mjs --execute --capture \
     --case qa --rep 1 --arm regular \
     --sent /private/pp0007-v2/sent.txt \
     --response /private/pp0007-v2/response.txt \
     --out /private/pp0007-v2/qa-r1-regular-capture.json
   ```

4. Repeat the second arm in the preassigned order, then all other repetitions and cases. Do not count a re-used conversation or altered prompt as a valid paired trial. Independently obtain grader rationales, code/test verification, and measurement/provenance evidence **after** collection under the preregistered rubric; no CLI-produced record awards a grade.

## Fail-closed guarantees and remaining limitations

- The program validates both **immutable** study identities: the original seven-case fixture Git blob `aa07d8296ab8c4ad492ec02863bd4203bb90ead4` and the preregistered v2 contract **raw-byte SHA-256** `a7d6c57a838e24358c34cc4dba2035d6cefd50d1361dbf08b9bcfe9f13b7e298`, established independently from trusted `main` commit `fb9b568fe2fb0df059a4cb6c519a4f92a722eec9` (Git blob `610ad35c145944b0f41ceb8f4f07a363046d3272`). It validates all 21 ordered pairs as two distinct arms, all 42 unique `(case,repetition,arm)` identities and 11:10 first-arm balance. Changed-but-balanced order, duplicate arms, altered JSON bytes, or changed source fixture fail closed. It returns 42 **potential** slots but **does not run 42 trials**. Updating the preregistration requires a separately reviewed version and pinned hash, not a self-recomputed digest.
- No implicit execution: `--execute` plus exactly one of `--prepare`/`--capture` is required. New outputs use exclusive `wx` creation, owner-only file mode 0600, no overwrites. Inputs are non-symlink regular files, strict UTF-8, bounded (16 KiB prompt, 256 KiB response), and outside the framework. Output directories must be POSIX-owner-controlled without group/other access.
- The submitted prompt's **actual raw bytes** must equal the exact immutable study prompt. Altered whitespace, appended instructions, and missing source files fail **before** output reservation. The response bytes are hashed and stored with the original text only in the local private output. No transcript contents are logged by the CLI.
- A hash, screenshot, typed model name or copied transcript alone cannot authenticate a provider response, model version, user timing, independent source test, receipt, or completeness. Every capture explicitly states `providerAuthenticated:false`, `providerExportVerified:false`, `grade:null`, `taskComplete:null`, and unknown cost/grants/corrections until separate evidence exists. A successful capture is **not a PP-0007 pass**.
- Uses a single-user trusted local filesystem. The input `lstat` then `readFile`, parent `realpath` then destination `open`, and file reservation then write are not atomic against malicious concurrent filesystem mutation or disk errors. A write failure may leave a partial private destination. Avoid shared/compromised paths; inspect failed outputs manually. No user-existing file is deleted.
- Independent PR #21 CHANGES_REQUESTED review reproduced an unpinned-order P1 on commit `c49718b6a24e9dcdaaae5cd56112236bbc29d77f` (200/200 green CI did not detect it). This repair pins the v2 contract and separately rejects duplicate-arm and missing-slot mutations, as well as changed-but-balanced order and byte-only changes. Re-review and fresh exact-head CI remain required.\n- `npm run check` includes negative collection tests. Passing CI validates only this collector; no genuine ChatGPT conversations, independent quality scores, comparative grade aggregates, or automatic Project message interception follow from these tests.

A meaningful paired comparison additionally requires genuine output and grant parity evidence, independently executed shared software tests, measured correction counts, resolved two-/three-rater grades, and actual private receipt verification. Continue to mark **PP-0007 in progress** until full acceptance and fresh independent milestone approval.
