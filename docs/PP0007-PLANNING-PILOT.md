# PP-0007 — bounded weekly planning pilot

This proposed reference-host addition is a **read-only, structured planning draft**, not autonomous scheduling or general AI planning. The host requires an explicit `capability: "plan.week"`, an ISO Monday `weekOf`, and an ordered list of 1–5 one-day tasks with unique slug IDs. Dependencies must refer only to earlier entries. Output has verified Monday-to-Friday date-only entries (UTC), dependency links, remaining workday count, and explicit limitations. No calendar, filesystem artifact, GitHub issue or other external action is created.

Example host request:

```json
{
  "objective": "Create a weekly project schedule",
  "capability": "plan.week",
  "inputs": {
    "weekOf": "2026-10-26",
    "tasks": [
      {"id": "scope", "title": "Define project scope"},
      {"id": "draft", "title": "Draft work plan", "dependsOn": ["scope"]},
      {"id": "review", "title": "Review dependencies", "dependsOn": ["draft"]}
    ]
  }
}
```

The `plan.week` grant is explicitly read-only and separate from the existing external-effect `operations` route. Missing schema, unknown fields, invalid calendar dates, cycles/forward dependencies, duplicates, over-capacity lists and embedded line breaks fail closed. Tests exercise a genuine Node host implementation using only deterministic code and check output structure and negative cases.

This is **not** the same request as the original seven-case benchmark, which deliberately routed unstructured planning to `operations` and correctly refused it. Those historical canonical reports stay unchanged. The new structured pilot should be measured separately until a controlled, revised benchmark comparison is run and its outputs independently reviewed. It cannot be counted as proof of an improved general-task completion rate or a ChatGPT/direct-LLM baseline. PP-0007 must remain `in_progress` until its original substantive acceptance criteria are satisfied.
