# PP-0007 — bounded JavaScript ISO-date parser pilot

The reference host now supports an explicitly selected `code.iso-date` software-profile, read-only capability. This returns a **real runnable JavaScript ES module** with a strict `parseIsoCalendarDate(value)` function and sample inputs/outputs. The module's emitted code is built from the **same function the local host calls**, not interpolated user code. The CI tests import the generated module and verify leap days, invalid dates and exact output parity.

The parser handles exactly the Gregorian `YYYY-MM-DD` calendar format for years 1000–2999, using UTC calendar operations. Invalid dates return `null`. It does **not** parse timestamps, locales, timezones or natural-language dates; it cannot write files, run arbitrary code, publish, install dependencies or synthesize unrestricted software.

### Request

```json
{
  "objective":"Implement and test a bounded ISO date parser",
  "capability":"code.iso-date",
  "inputs":{"examples":["2024-02-29","2025-02-29","2026-10-21"]}
}
```

The returned `source` may be copied into a local `parse-iso-date.mjs` module, but the reference host does not itself write that file. The `software` general capability remains unsupported. A bounded ASCII allowlist protects example text; any sample can be syntactically invalid as an ISO date, in which case its output is `null` and not an error. Only the fixed trusted program text is imported during tests.

This distinct structured request **must not change the historical seven-case PP-0007 benchmark's 2/7 full user-request completion measure**. It is not a general code-generation LLM, doesn't demonstrate human success/correction improvements, and supplies no direct-assistant baseline or token accounting. PP-0007 remains `in_progress` and requires independent review before claiming even the scoped code contribution is ready.
