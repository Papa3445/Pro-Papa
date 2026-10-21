# PP-0001 implementer acceptance observations

- Fixed code-defined validator registry includes software syntax, research citation structure, and document Markdown structure. The project policy can disable them but cannot define executable commands.
- Negative tests cover injected commands, unsupported capabilities, symlink escape, malformed inputs, stale source proofs, code-fenced headings, and source mutation during validation.
- Built-in `adapter` evidence is separate from substantive `test`, `sources`, and `validation` evidence. A failing adapter cannot be replaced with a manual adapter pass; actual runtime-test evidence remains recordable.
- Legacy v0.1 task state without `requiresAdapter` remains readable and closable. Old adapter-type records are preserved without masquerading as current runtime tests.
- GitHub Actions verification passed on commit `d5e05c1ef095d65507bd3d732e7aeee54f39e836`; final PR head may change again after evidence updates and requires new CI verification.
- External reviewer PASS has NOT yet been observed for this revision, so PP-0001 must remain in progress and PR #1 unmerged.

Review limitation: The source-controlled evidence ledger is not provider-authenticated; PP-0002 will implement trusted candidate/reviewer binding.
