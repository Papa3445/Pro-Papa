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

The command chooses an adapter from the active task's profile, validates `.pro-papa/adapter-policy.json`, resolves a project-local file, runs a deterministic check, and generates a JSON report under `.pro-papa/evidence/ID/`. It hashes the report with the existing proof ledger and records a `pass` or `fail` under that profile's evidence kind. An adapter failure exits nonzero **after saving the failing result**.

| Profile | Fixed capability | Input | Evidence generated | What it actually checks |
|---|---|---|---|---|
| software | `syntax:node` | `.js`, `.mjs`, `.cjs`, `.json` | `test` | Node.js syntax (`node --check` with a fixed shell-free invocation) or JSON parsing; no source script execution |
| research | `citations:structure` | `.json` | `sources` | Structured source IDs, HTTPS URLs, and each claim's references |
| document | `markdown:structure` | `.md` | `validation` | A title, two sections, minimum 40 words, and no obvious placeholders |

Research JSON format:

```json
{
  "title": "Example",
  "sources": [{ "id": "source1", "title": "Referenced study", "url": "https://example.org/study" }],
  "claims": [{ "text": "The observed result", "sourceIds": ["source1"] }]
}
```

All input files must exist inside the project (including their resolved symlink targets), must be regular files, and must be 1 byte to 1 MiB. The command records the actual source file SHA-256 in its report. A project policy can **disable** any built-in adapter, but cannot authorize arbitrary commands or dynamically load code.

## What a pass does *not* mean

- Software syntax does not establish that software runs, is secure, or satisfies acceptance.
- Research citations are not fetched or fact-checked. A made-up HTTPS link can pass structural checks.
- Document headings and word counts do not establish accuracy, quality, tone, or usability.
- A proof digest does not establish that observations are true. The implementer can still create dishonest files.
- Adapter output does **not** supply the `artifact`, independent `review`, or every other required proof. A task cannot close from an adapter result alone.
- The current reviewer name is self-declared; PP-0002 will add authenticated, candidate-bound independent review.

## Adding another domain

Extend the statically registered `BUILTIN_ADAPTERS`, implement a safe validator within `src/adapters.mjs`, review permissions, add adversarial tests, then update the profile's requirements and policy schema. Do **not** interpret task-supplied commands or dynamically import modules from a report, source, or task description. Future adapters needing network access, side effects, or external credentials require an explicit authorized host capability instead of extending the local read-only checks implicitly.
