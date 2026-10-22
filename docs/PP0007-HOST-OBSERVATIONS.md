# PP-0007 — canonical one-case reference-host observations

The benchmark now has **two explicit observation arms** bound to the same independently reviewed seven-case JSON fixture. The [API collector](PP0007-API-BASELINE.md) sends a model the canonical objective plus serialized input data. This **host** collector invokes the actual bounded Pro-Papa reference host with the **unchanged objective**, **same canonical inputs**, and the fixture's **original requested capability**. Both arms expose the same `objectiveSha256`, `inputsSha256` and `fixtureGitBlobSha`, enabling a later investigator to pair records by identity without rewriting the original questions.

This tool **does not** call an LLM, compare output quality, generate extra capabilities, grade an answer, create an audit receipt or persist a task. By default it uses only local fixed handlers. Q&A, general software authoring, document generation and novel/fallback remain `unsupported` on the original prompts; original planning/operations is **`denied`** because no external-effect approval exists. Numeric `math.sum` can complete. A different structured-input experiment in `bin/benchmark-structured-pp0007.mjs` cannot be substituted for these cases.

## Run an original host case

Use Node.js 20+ and an **existing private, operator-controlled directory outside the framework**. Each invocation requires explicit intent and saves exactly one new file with `0600` permissions (never overwritten). No API token is needed:

```sh
node bin/pp0007-host-observation.mjs \
  --execute --case data \
  --out /private/pp0007/host-data.json
```

The research case is **read-only**. To permit its single public GitHub repository GET, supply a separate explicit flag:

```sh
node bin/pp0007-host-observation.mjs \
  --execute --case research --github-read \
  --out /private/pp0007/host-research.json
```

The host is allowlisted to `Papa3445/Pro-Papa`; no `GITHUB_TOKEN` is passed, no GitHub POST is registered, and the native path uses the Node runtime's network transport. GitHub research is **not** authorized merely because a user objective contains a repository name. There are no automatic retries; a failed read remains a failed task. `--github-read` with any other case is invalid.

## Meaning of the recorded fields

- `resultStatus`, `execution`, `actualCapability`, `auditStatus` and `trackingMode` come from the actual `createReferenceHost` and `runGateway` call. Output content is kept in the private local file, not printed to stdout.
- `githubTransportAttemptsObserved` counts instrumented fetch invocations. It **does not independently prove packets were sent**; `githubNetworkRequestsIndependentlyConfirmed` is therefore `null`. An injected client is possible in test-only `simulation` mode, always labeled `simulation_only_no_provider_evidence`.
- `latencyMs` measures one host request, not identical startup and overhead boundaries to the API request. `providerReportedTokens`, `qualityGrade`, `taskSuccess`, `correctionInteractions`, and `privateUsageReceipt` remain `null`, not fabricated zeros or successes.
- `persistenceObserved:false` is deliberate: these one-case observations are ephemeral and do not provide evidence of durable task persistence. `toolPermissionsComparableToApiBaseline:false` for GitHub research explicitly warns that the API arm has `tools:[]`, whereas this research arm uses GitHub read access.

## Paired-study limitations

The mere presence of one host observation and one API observation with matching hashes is **not** a graded comparable trial. A private operator must independently verify both raw files, freeze the exact source commit and model/API version, assess permission asymmetry, grade actual outputs, and record per-turn corrections and comparable latency/cost metrics. The API arm remains **text-only with no tools** and is not the ChatGPT UI. Avoid claiming superiority or closing PP-0007 without the remaining cross-domain acceptance, review, and actual provider evidence described in [the paired-trial protocol](PP0007-PAIRED-TRIAL-PROTOCOL.md).

To test without external access, run `npm run check`. The tests run a **real local** `math.sum` host operation and simulated GitHub research; simulation tests do not establish a real GitHub network observation. The separate historical benchmark already contains provider-backed GitHub GET evidence, but it is not this prospective matched trial.
