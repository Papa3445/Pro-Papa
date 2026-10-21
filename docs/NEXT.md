# Next development increments

**Authority:** `.pro-papa/tasks.json` is the only executable task queue. This document explains the intended architecture and acceptance focus; do not maintain a separate checklist here.

## Intent

Make Pro-Papa a **universal, host-invoked work framework** for user requests, not a research-only assistant, code-only workflow or cosmetic usage logger. Deliver real authorized outcomes and retain only the evidence necessary for reproducible review.

## Sequence

**PP-0004 — Complete existing receipt-task closeout.** Real GitHub private-repo read/write/readback and independent PR approval have been recorded. The active task still needs authenticated artifact provenance, its genuine built-in `adapter-check` evidence, and an actual trusted `close` verification. Do not manufacture adapter evidence or claim the CLI ran when only the GitHub connector ran.

**PP-0005 — Universal gateway contract and implementation.** A runnable entry point classifies/routs objectives to **authorized typed capabilities** without granting commands or credentials from user text. Choose ephemeral handling for routine questions and per-project durable state for substantial work. Preserve failures and make honest source/receipt links. Keep implementation small and testable; no speculative agents or automatic ChatGPT-hook claims.

**PP-0006 — Reference execution host and audit enforcement.** Connect PP-0005 to a real supported caller and configured tools, demonstrate work actually executed, and require accurate receipts or truthful degraded status when audit is configured. Establish precisely what is and isn't feasible in normal ChatGPT Projects versus a dedicated host/app. Do not promise native interception absent a supported product capability.

**PP-0007 — Cross-domain acceptance and measurable value.** Reproduce substantive requests across quick answers, research, software, documents, data/calculations, operations and unknown-domain fallback. Verify real outputs **separately** from usage receipts, compare friction/quality with direct assistant workflow, document failures and secure independent exact-head review.

## Scope boundaries and quality gates

- Host/model capabilities and real permissions determine actual execution. The repository alone cannot force ChatGPT tool calls or provide autonomous background work.
- Only the separately configured **private** audit repository may receive minimal usage receipts. A receipt attests a provider-visible operation and private write/readback, **not** hidden reasoning, content quality or a guaranteed one-to-one ChatGPT-turn mapping.
- No untrusted prompt/external content may register shell commands, dynamic arbitrary tools or elevated privileges. Publishing, buying, deleting, changing permissions or contacting external accounts requires explicit host authorization.
- Use the existing domain profiles, hashed evidence, PR-based CI and genuine independent review gates. Keep each milestone one coherent implementation + verification cycle, and block unmet external deployment steps without fabricating proof.
- Success metric: more completed validated user objectives with fewer corrective turns and less unnecessary orchestration, **not** number of Git commits or receipts.

See `prompts/development-starter.md` for the copyable development handoff.
