# Pro-Papa

A general-purpose, repository-backed AI execution framework.

Pro-Papa adapts the reusable orchestration concepts developed for [Ironshade Vector](https://github.com/papa4568/ironshade-vector) to different domains. It tracks tasks, evidence, failure recovery, and verification without embedding game-specific code.

See `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/SECURITY.md` for the execution contract, architecture, and limitations.

Requirements: Node.js 20+. Commands: `npm test`, `npm run check`, `npm run next`, `npm run status`.

**Current status:** v0.1 establishes task coordination and evidence bookkeeping. It does not independently call an AI model or authenticate a verifier; external agent runtimes and reviewers are required for autonomous execution and trustworthy review.
