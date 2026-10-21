# Transfer from Ironshade Vector

The original source remains at https://github.com/papa4568/ironshade-vector. No game source files or project-specific runtime rules are copied.

| Reusable concept | Pro-Papa representation | Boundary |
|---|---|---|
| `AGENTS.md` execution contract | concise root `AGENTS.md` | No Android/game limits |
| Ordered Markdown roadmap | `.pro-papa/tasks.json` | Machine-readable single source of truth |
| Task graph and dependencies | task `dependsOn` + cycle validator | No separate competing queue |
| Domain proof profiles | `.pro-papa/profiles.json` | Different outputs have different proof needs |
| Candidate proof integrity | project-local SHA-256 evidence | Identity not authenticated yet |
| Independent verifier | `prompts/verifier.md` and distinct actor check | Self-declared, not trusted host identity |
| External QA and blockers | blocked states and blocker explanation | No fake claims of physical verification |
| Test gates | `node --test` and CI | Checks the framework only |

Upgrade philosophy: extract stable methods first; only promote complex enforcement after measuring genuine failure classes in diverse domains.
