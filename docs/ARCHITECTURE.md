# Architecture and design choices

## Boundaries

**Model/host** (ChatGPT with supported tools, an AI agent runner, human) understands goals and performs actions. **Pro-Papa** holds durable task state, acceptance criteria, proof requirements, and deterministic lifecycle transitions. **Domain adapters** have a v0.1 built-in interface for bounded syntax, citation-integrity, and Markdown-structure checks. Broader authenticated tool/host adapters are future work. **Verifier** should independently challenge the exact output and record a traceable result. **Project repository** owns its artifacts and state.

The model is interchangeable. The repository is not a background process, and writing prompts is not equivalent to invoking external tools.

## State machine

`pending -> in_progress -> verified` or `pending/in_progress -> blocked -> pending`. One active task maximum. The next selector resumes an active task first, else chooses the earliest pending task whose prerequisites are verified. Blocked tasks are skipped; unresolved dependencies remain blockers only for dependent tasks. Explicit user priorities can be represented by editing/reordering tasks in reviewed changes.

Task closure requires the latest proof of each required kind to pass, every referenced evidence file to still hash to the recorded SHA-256, and a review actor declared distinct from the implementation owner. Built-in adapter proofs cannot be replaced with manual evidence, and their input digests must still match at closure. This is a **procedural gate**, not an independently authenticated assessment. Inputs under source control can be altered; Git history and a future trusted verifier are required for tamper-resistant remote trust.

## Separation of concerns

1. The task queue contains one authoritative definition of order, dependency and acceptance.
2. Profiles constrain evidence kinds without embedding arbitrary shell commands into a task.
3. CLI functions accept explicit file paths, enforce project boundaries and never evaluate task content as code.
4. Agent prompts are short and execution-neutral; a model decides how to pursue work within permitted tools.
5. Visual/subjective results need actual content inspection; tests and hashes do not establish quality.
6. Production integrations must authenticate verifiers and pin candidates to immutable versions instead of trusting actor strings.

## Why not migrate Ironshade's entire governance system?

Its game-specific Android, physics, rendering, performance, and heavyweight CI controls are inappropriate for arbitrary work. The initial universal kernel deliberately has few moving parts. New enforcement layers should require reproducible failures and demonstrated value.

## Roadmap authority

`.pro-papa/tasks.json` is the only executable task queue. This document describes design, not duplicate progress state. `docs/TRANSFER.md` maps extracted concepts to the original project.

## Domain adapter interface

Built-in static adapter dispatch is keyed by the in-progress task profile. The allowed capabilities are defined in code; `.pro-papa/adapter-policy.json` can deny an adapter but cannot load arbitrary executables or extend authority. The checked project-local input is size-bound and realpath-validated, and the resulting check report is hashed into existing evidence state. See `docs/ADAPTERS.md` for formats, limitations and examples.
