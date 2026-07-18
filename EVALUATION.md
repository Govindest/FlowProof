# FlowProof evaluation

Generated 2026-07-18T06:54:52.379Z by executing real Playwright runs in seeded diagnosis mode.

## Measured summary

- Expected outcomes observed: **6/6**
- Breaking faults detected: **5/5**
- Correct invariant identified: **5/5**
- Complete screenshot + trace evidence: **6/6**
- Failure diagnoses citing relevant evidence: **5/5**
- Mean browser execution duration: **2117ms**

## Executed cases

| Case                         | Expected | Observed | Correct invariant | Evidence | Diagnosis cites evidence | Duration |
| ---------------------------- | -------- | -------- | ----------------- | -------- | ------------------------ | -------: |
| UI drift                     | FAIL     | FAIL     | Yes               | Complete | Yes                      |   6383ms |
| Missing business side effect | FAIL     | FAIL     | Yes               | Complete | Yes                      |   1515ms |
| Permission drift             | FAIL     | FAIL     | Yes               | Complete | Yes                      |   1258ms |
| Unexpected initial state     | FAIL     | FAIL     | Yes               | Complete | Yes                      |   1040ms |
| Incorrect step sequence      | FAIL     | FAIL     | Yes               | Complete | Yes                      |   1226ms |
| Non-breaking cosmetic change | PASS     | PASS     | N/A               | Complete | N/A                      |   1280ms |

## Method

Each case resets authoritative demo state, enables one seeded regression, executes the stored runbook in Chromium, evaluates typed preconditions and invariants, verifies artifact files on disk, and checks diagnosis evidence references. The cosmetic control must remain PASS. GPT-5.6 or seeded diagnosis never determines the verdict.

Machine-readable source: [`evaluation/results.json`](evaluation/results.json). Reproduce with `pnpm seed && pnpm evaluate`.
