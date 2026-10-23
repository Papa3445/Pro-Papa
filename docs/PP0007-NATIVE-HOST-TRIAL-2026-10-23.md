# PP-0007 — frozen seven-case native host observation (2026-10-23)

**Status:** Real CI-executed local reference host, **not** an independently
quality-graded ChatGPT comparison or PP-0007 milestone closure.

## Reproduction and source identity

- Canonical fixture: `fixtures/pp0007-paired-trial-collection-template.json`,
  immutable Git blob `aa07d8296ab8c4ad492ec02863bd4203bb90ead4`.
- Native test: `tests/pp0007-native-seven-host-study.test.mjs`.
  Uses actual `runHostOne` and `canonicalTrial` with **unchanged original
  objective, capability and inputs** for each of seven cases.
- Original comparison base: main at
  `4f0a4d6497a50b2a06645670d2255addbf94e020`.
- Actual `pull_request` CI before this documentation update:
  [GitHub Actions run 39889956053](https://github.com/Papa3445/Pro-Papa/actions/runs/39889956053),
  source head `3d50ade8baa94aa1046c5c25911349ceaeea2484`,
  check job `120207065240`: **191 tests passed, 0 failed, 0 skipped**;
  project validator reported `valid:true`.

## Seven original native host outcomes

Numbers below are the actual host-call `latencyMs` values emitted in the
above CI job, **not** comparable full-response ChatGPT UI elapsed time.

| Canonical case | Native status | Host call ms | GitHub attempts |
| --- | --- | ---: | ---: |
| qa | unsupported | 0.923 | 0 |
| research (no grant) | denied | 0.108 | 0 |
| software | unsupported | 0.085 | 0 |
| document | unsupported | 0.083 | 0 |
| data | completed | 1.183 | 0 |
| planning | denied | 0.049 | 0 |
| novel | unsupported | 0.047 | 0 |

The **only** completed original fixed-handler case was `math.sum`,
which returned `{total:10,count:3}`. Original-case completed handler
count: **1/7**; this is **not** a human-graded cross-domain task-success rate.
Other statuses are genuine unsupported/denied results, not successful safe
completions. All seven log `taskSuccess:null`, `providerReportedTokens:null`,
`auditStatus:not_requested`, `persistenceObserved:false`.

## Separately granted native research

The same exact-head CI made **one real native read-only GitHub research
attempt** for the original repository, using an explicit trusted
`githubRead:true` grant. The host reported `completed`,
`githubTransportAttemptsObserved:1` and `latencyMs:275.894`.
`githubNetworkRequestsIndependentlyConfirmed` remains `null`.
This result is separate from the original *ungranted* research case; it does
**not** make tool permissions comparable to the direct ChatGPT UI baseline.
No GitHub POST, audit receipt, durable task mutation, model API call or
billable LLM invocation occurred in these tests.

## Evidence boundary

Seven independent direct ChatGPT baseline screenshot sets were
**operator-supplied and retained outside the public repository**. They are
not provider-authenticated or blindly quality-graded. The software baseline
claims a ZIP and test success that has not been independently executed.
The novel baseline requested clarification rather than completing a specific
tradeoff analysis. Context/personalization and tool grants may differ.

Do not compare the above millisecond local handler calls to UI-reported
response time, infer unavailable tokens, claim ChatGPT baseline task grades,
treat CI or receipts as proof of answer quality, or close PP-0007.
Further acceptance requires authentic matched inputs/permissions, actual
evidence verification, negative security cases, corrections, independent
quality assessment, a current-head trusted review, and genuine task-state
validation.

**To reproduce** on an authorized Node 20+ checkout run `npm run check`
and inspect the `PP0007_NATIVE_SEVEN_CASE_RESULTS` and
`PP0007_NATIVE_GRANTED_RESEARCH` lines. The separately granted public
GitHub GET may honestly report `provider_unavailable` on a runner lacking
network access; the test does not turn that into a claimed provider success.
