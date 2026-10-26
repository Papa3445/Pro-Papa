# F-01 isolated merge-gate challenge probe

**This is a disposable NON-MERGE test artifact.** It exists solely to see whether the active native `main` protection actually blocks an unreviewed pull request after a successful GitHub Actions required check. It must not be merged or deployed, reviewed as a normal feature, or included in the task ledger.

Test baseline: GitHub `main` 39076ac85a6864dd007b9ed6c947389548878508, ruleset #25921403 active, required native check `Verify Pro-Papa / check`, one fresh independent review required.

Phase 1: harmless Markdown-only source change, no independent approval submitted. Expected: real CI green while GitHub marks merge state **blocked** for missing approval.

Phase 2: intentionally failing isolated Node regression *only on this probe branch*, expected CI red and merge ineligible. Restore or close probe after recording evidence, without touching main.

If read-only GitHub merge metadata or native checks cannot distinguish these stages, explicitly report the limitation rather than claim successful enforcement.
