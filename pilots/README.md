# PP-0003 — three reproducible domain pilots

## Scope

A disposable initialized Pro-Papa project contains three ordered tasks: a pure software decision utility, a source-linked three-claim research artifact, and a bounded Markdown handoff guide. The integration test calls the **actual** Pro-Papa task, adapter and evidence APIs, persists the project, then reloads and checks status and each proof file's SHA-256.

## Validation and adversarial cases

- **Software:** execute eight boolean combinations and reject a nonboolean input. An intentionally invalid source fails the syntax adapter before a fixed version passes.
- **Research:** an unknown source ID fails the adapter; a false claim with **valid source IDs** passes the adapter's structural check but fails `auditResearchClaims` against explicit source-specific excerpts and exact approved proposition wording. A corrected claim then passes both checks.
- **Document:** a TODO placeholder fails the structural adapter; a structurally valid but contradictory runtime guarantee passes the adapter yet fails `auditDocumentGuide`. Extra keyword-padding and a changed supporting primary source also fail the editorial audit. The actual guide passes its curated section-by-section requirements and support excerpts.

These audits are intentionally **bounded to the provided three claims and single sample document**. They do not establish generic semantic understanding, live external source verification, or broad factual reliability.

## Evidence and actual observations

`tests/pilots.test.mjs` records artifact, domain, validation and simulated reviewer evidence separately from the built-in adapter proof, exercises the missing-evidence closure block, and closes all three tasks. Pilot reviewer accounts are **simulated**, not provider-authenticated. See [measured CI outcomes, rework and implementation-effort limitations](RESULTS.md). The production PP-0003 task is not complete until independent review approves this PR.

Run `npm run check` to reproduce. GitHub Actions logs expose a parseable `PP0003_PILOT_REPORT` line. Do not replace genuine source inspection or editorial review with these fixtures outside their fixed scope.
