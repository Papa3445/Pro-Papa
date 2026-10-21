# Built-in domain adapters (PP-0001)

These adapters are **read-only validation helpers**, not autonomous execution of a user's requests. The AI or human host still creates the artifact with authorized tools. Pro-Papa checks supported artifact properties using code-defined capabilities; task text and configuration cannot register shell commands, scripts, plugins or new capabilities.

## Run an adapter

```bash
node bin/pro-papa.mjs start --id PP-0001 --actor implementer
node bin/pro-papa.mjs adapter-check --id PP-0001 --actor implementer --file src/adapters.mjs
```

Or, for a newly initialized project:

```bash
node /path/to/Pro-Papa/bin/pro-papa.mjs init --root /path/to/project --name Example
node /path/to/Pro-Papa/bin/pro-papa.mjs add --root /path/to/project --title "Review sources" --objective "Source-checked report" --profile research --accept "Claims cite sources"
# Start the new task and supply the matching --id to adapter-check.
```

The command chooses an adapter from the active task's profile, validates `.pro-papa/adapter-policy.json`, resolves a project-local file, runs a deterministic check, and generates a JSON report under `.pro-papa/evidence/ID/`. It hashes the report with the existing proof ledger and records a `pass` or `fail` under a distinct `adapter` evidence kind. This check is separate from genuine software `test`, research `sources`, or document `validation` evidence. An adapter failure exits nonzero **after saving the failing result**.

| Profile | Fixed capability | Input | Evidence generated | What it actually checks |
|---|---|---|---|---|
| software | `syntax:node` | `.js`, `.mjs`, `.cjs`, `.json` | `adapter` | Node.js syntax (`node --check` with a fixed shell-free invocation) or JSON parsing; no source script execution |
| research | `citations:structure` | `.json` | `adapter` | Structured source IDs, HTTPS URLs, and each claim's references |
| document | `markdown:structure` | `.md` | `adapter` | A title, two sections, minimum 40 words, and no obvious placeholders |

Research JSON format:

```json
{
  "title": "Example",
  "sources": [{ "id": "source1", "title": "Referenced study", "url": "https://example.org/study" }],
  "claims": [{ "text": "The observed result", "sourceIds": ["source1"] }]
}
```

All input files must exist inside the project (including their resolved symlink targets), must be regular files, and must be 1 byte to 1 MiB. The command records the actual source file SHA-256 in its report. At closure, the CLI recomputes the input digest and rejects any source changed since the passing check. Software syntax checks run against a private snapshot of the exact bytes hashed; the original source is checked again after validation. A manual `proof --kind adapter` cannot replace the built-in adapter result. Separate manual proofs for the domain remain available (`test` for runtime tests, `sources` for source audits, and `validation` for substantive document review). A failing adapter result still blocks closure even if all manual proofs pass.

A project policy can **disable** any built-in adapter, but cannot authorize arbitrary commands or dynamically load code.

## What a pass does *not* mean

- Software syntax does not establish that software runs, is secure, or satisfies acceptance.
- Research citations are not fetched or fact-checked. A made-up HTTPS link can pass structural checks.
- Document headings and word counts do not establish accuracy, quality, tone, or usability.
- A proof digest does not establish that observations are true. The implementer can still create dishonest files.
- Adapter output does **not** supply the `artifact`, independent `review`, or every other required proof. A task cannot close from an adapter result alone.
- The current reviewer name is self-declared; PP-0002 will add authenticated, candidate-bound independent review.

## Adding another domain

Extend the statically registered `BUILTIN_ADAPTERS`, implement a safe validator within `src/adapters.mjs`, review permissions, add adversarial tests, then update the profile's requirements and policy schema. Do **not** interpret task-supplied commands or dynamically import modules from a report, source, or task description. Future adapters needing network access, side effects, or external credentials require an explicit authorized host capability instead of extending the local read-only checks implicitly.

## Compatibility with pre-adapter projects

Existing v0.1 project state files and previously completed tasks remain valid. The optional `requiresAdapter` field is set on **new** tasks in the three supported profiles; existing tasks that lack the field retain their previous proof requirements. Set `requiresAdapter: true` on an existing pending/in-progress task to opt it into the new gate. Once any task records a new `adapter` proof, its latest adapter result must also pass at closure. Historical `builtin-adapter` records under `test`, `sources`, or `validation` remain readable, but they do **not** substitute for genuine domain evidence when a task requires a separate adapter result. No retroactive changes to verified historical tasks are needed.

The `proof --kind test` command is intentionally usable for real test output. It does not rerun the tests or authenticate their results, so attach actual observed output and obtain separate review.
