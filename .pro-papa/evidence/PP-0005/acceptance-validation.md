# PP-0005 — Acceptance and adversarial self-validation (implementation candidate)

## Scope and evidence

Framework base: merge commit 581c7f53d05061a2c10e1968b94d1acbf539206e (PP-0004 verified).
Task: PP-0005, software profile. This is an implementer assessment, **not** independent approval.

- Real code: src/gateway.mjs and bin/gateway.mjs on the PP-0005 branch.
- Real integration/adversarial tests: tests/gateway.test.mjs and tests/gateway-cli.test.mjs.
- GitHub Actions [run 39681926039](https://github.com/Papa3445/Pro-Papa/actions/runs/39681926039), job 119506291353: 98/98 tests passed; includes the temporary, actual built-in adapter-check on src/gateway.mjs.
- The adapter's exact report was committed to .pro-papa/evidence/PP-0005/software-f7ff123c-52e9-477e-8855-a1bfd4f2bd2c.json with SHA-256 bc8ce90768eab631d69d9b627e09ff4efd21be3d40832e6a9470f4e82f0d1979; source SHA-256 96277c35d9fe978db08d090eea81957e38f1c47d6d9938bf7959f8af1af24a88.

## Acceptance assessment

1. **Runnable arbitrary-objective entry point:** JSON-stdin CLI accepts arbitrary nonempty objective strings and maps to a fixed set of recognized routes; two real read-only handlers execute deterministic calculations. Other domains require an explicitly configured host provider or return unsupported. Routines stay ephemeral; durable mode requires host flag/permission and an initialized user project. It does not silently add tasks to the framework roadmap. Supported with the stated host-only limitation.
2. **Untrusted-data authority boundary:** No shell dispatch or plugin install route exists. Task hints cannot register handlers or grant permissions. The trusted host owns capability handlers, grant lists, approved external effects, and task-write authorization. Adversarial tests cover injected shell text, missing permissions, missing effect approval, invalid source selectors and malformed CLI input. Supported within a trusted-host boundary.
3. **Outcomes, provenance and receipts:** The gateway reports completed, denied, unsupported, unavailable and ambiguous outcomes separately. Validated provider-asserted operation metadata accompanies a successful handler result. PP-0004 issuance is opt-in from the host; failure is reported separately and cannot make an unsuccessful tool operation appear complete. A receipt alone does not certify the handler or output. Supported, but third-party provider truth remains host-dependent.
4. **Negative/resume/isolation:** Tests cover unknown routes, malformed proof responses, duplicate request IDs, reused IDs with different inputs, handler errors, authorized read-only retry, blocked ambiguous retry, concurrent same-ID calls, queued work behind active projects, source prompt omission from saved project state, and explicit project-root separation. Supported at tested boundaries.

## Risks and deliberate limits

- All external handlers are injected by an authorized host, whose permission enforcement and provenance truth must be verified separately. A malicious trusted host can lie or perform an undisclosed side effect.
- The reference CLI only provides math.sum and text.metrics. A production multi-provider app or automatic ChatGPT interception is **PP-0006**, not this implementation.
- Classification by regex hints is shallow. An unrecognized objective falls back to general only when that trusted handler is installed and granted; otherwise it honestly returns unsupported.
- Reservation-before-execution and HMAC idempotency are not distributed transactions. A host crash during an external effect yields needs_reconciliation and must not trigger automatic re-execution.
- Secrets, request text, and outputs are not persisted by the gateway task record. Private operations still depend on the security and confidentiality of the host, the user project, and the GitHub audit repository.
- Passing tests and syntax checks are not independent security assurance or domain-quality assessment.
- No formal closeout until the final four-domain acceptance is independently challenged on the exact PR head, exact-head CI is green, and all required evidence including real GitHub independent review is recorded.

## Provisional result

**Implementer validation: pass for the documented PP-0005 gateway/CLI contract. Independent review outstanding.**

## Independent CHANGES_REQUESTED review and remediation (second candidate)

Authenticated review [#5606919958](https://github.com/Papa3445/Pro-Papa/pull/6#pullrequestreview-5606919958) found four blocking deficiencies on the original candidate c3b927f6bb93d37e5b8915c5fc44e39bfb6a4578. They are **not represented as cleared by the reviewer** until a new exact-head APPROVED review is received.

- P1 metadata symlink isolation: gate now checks canonical project, physical .pro-papa directory and tasks.json identity, rejects symbolic links and hard-linked state files, and rechecks before each gateway-managed state write. New tests use disposable victim/user project directories and verify no victim ledger mutation. The check is not atomic against privileged concurrent filesystem swaps.
- P2 UUID casing: normalize case at ingress, storage and lookup; a real external-effects handler cannot execute twice via uppercase/lowercase variants in a durable fixture.
- P2 audit confirmation: the built-in CLI selects a direct PP-0004 issuer invocation, preserving its source-read/private-write/readback verification. Third-party host callbacks can only produce host_asserted when receipt identities are internally consistent and the expected audit repository matches; contradictions or incomplete identity fail. This does not make a third-party host's claimed proof independently verified.
- P3 undefined output: completed now requires a defined, JSON-serializable (at most 256 KiB) output and matching host-provided operation provenance; absent or unserializable output yields unverified_execution.

Real GitHub Actions [run 39691477143](https://github.com/Papa3445/Pro-Papa/actions/runs/39691477143), job 119538442712, passed 103/103 tests on security-fix code. GitHub Actions [run 39691557411](https://github.com/Papa3445/Pro-Papa/actions/runs/39691557411), job 119538710648, passed 103/103 **and** executed the real built-in syntax:node adapter against fixed src/gateway.mjs; the emitted report was saved at .pro-papa/evidence/PP-0005/software-846efd48-2a0a-46d9-ab54-cbe21660b745.json and separately hash-verified against returned provider bytes. The adapter is syntax-only, not an independent security audit.

**Status:** implementation regression validation PASS; reviewer change requests remain outstanding until exact revised-head review. No merge or task closeout authorized by this document.

## Second independent re-review: output integrity correction

The independent reviewer submitted [CHANGES_REQUESTED #5607435042](https://github.com/Papa3445/Pro-Papa/pull/6#pullrequestreview-5607435042) on the previous exact head `6d1d81f99424ac905917bf7d413a3ca726ef1d68`. The original P1 symlink and P2 UUID/audit fixes were independently accepted; one remaining P2 issue concerned lossy `JSON.stringify` output validation, stateful `toJSON`, and mutable postvalidation output references.

Remediation: `src/gateway.mjs` now recursively validates strictly supported JSON values, rejects nested NaN/Infinity, functions, undefined, symbols, unsupported object prototypes (Map/Error/Date), non-enumerable/accessor fields, invalid arrays, cycles, negative zero, and excessive depth/nodes. It builds a detached snapshot, serializes it once under a 256-KiB wire limit, parses that canonical JSON, and returns **only** this detached value. A host cannot change the returned result by mutating its original output after completion. Provenance fields are independently copied as primitive data.

The seven new tests in `tests/gateway-json-snapshot.test.mjs` cover these cases, including an authorized **durable external-effect handler** whose malformed nested numerical output is classified `unverified_execution`, whose task remains `ambiguous`, and whose retry cannot double-execute. An explicit JSON acknowledgement still succeeds.

Real [GitHub Actions run 39693426017](https://github.com/Papa3445/Pro-Papa/actions/runs/39693426017), job 119544909737, passed **110/110** tests on the revised implementation. Real [run 39693487152](https://github.com/Papa3445/Pro-Papa/actions/runs/39693487152), job 119545118986, passed **110/110** and **executed the authentic built-in adapter-check** on the latest gateway source. Its report `.pro-papa/evidence/PP-0005/software-5c76dbd2-93af-4481-b2ca-ff70bd1d4527.json` was extracted from the provider job log, persisted, and digest readback confirmed. Source SHA-256 `24a84741e5c0cbfccd015b1f5e0435d7fadeb367d80424cf62ed493612ea3e28`, report SHA-256 `9be34f9bcccf5b43c966728dafbba194ca68a5944051db6ad676ff6ffcbf98e8`.

These are **implementer-observed remediations**, not an independent finding that the revised issue is closed. Fresh exact-head CI and new independent reviewer approval remain necessary before task closure or merge. No PP-0006 work is included.
