# FlowProof demo — 2:45

## 0:00–0:20 — Problem and product

Open <https://flowproof-ten.vercel.app>, or `http://localhost:3000` for the deterministic local demo. Confirm **Execution backend online** in the header.

> FlowProof is CI for business operations. Deployments can be green while offboarding, refunds, or access policies silently fail. FlowProof replays those workflows, verifies real business outcomes, and preserves proof.

Point to three seeded runbooks and executed evaluation summary.

## 0:20–0:45 — Known-good baseline

Open **Fixture control**, click **Reset all to pass mode**, then run **Offboard Contractor** from Workflows.

Show PASS banner, six browser steps, screenshots, three deterministic invariants, and trace download.

> Identity is disabled, active login is denied, and repository membership is removed. This is our known-good proof.

## 0:45–1:10 — Inject meaningful failure

Return to **Fixture control** and enable **Repository permission drift**. Run Offboard Contractor again.

> Browser actions still complete. Identity is disabled and login is blocked, but repository revocation silently fails.

Queued page should move from QUEUED to RUNNING to FAIL automatically.

## 1:10–1:45 — Evidence and GPT-5.6 diagnosis

Show:

- violated `Repository membership removed` invariant;
- final screenshot showing membership remains;
- Playwright trace link;
- JSON result, evidence Markdown, and GitHub issue draft;
- **Seeded GPT-5.6 diagnosis** with root cause, business impact, 98% confidence, human-approval requirement, and cited invariant/screenshot/trace.

> Deterministic verifier decides FAIL. GPT-5.6 only interprets captured evidence. With an API key, the same typed schema uses live GPT-5.6; default seeded output keeps judging reproducible.

## 1:45–2:05 — Repair and prove recovery

Click **Repair & rerun** on the FAIL report.

Show new queued run completing PASS.

> Repair resets the fixture, then creates fresh browser proof. FlowProof does not mark an incident resolved from intent; it requires a passing rerun.

## 2:05–2:25 — Evaluation

Return home and point to evaluation summary.

> Six executed cases cover UI drift, missing side effects, permission drift, unexpected initial state, incorrect sequence, and a cosmetic control that must stay green. Run IDs, durations, artifacts, and machine-readable results are committed.

## 2:25–2:45 — OpenAI and Codex

Open **New runbook** briefly.

> GPT-5.6 compiles natural-language SOPs into typed steps, conditions, invariants, evidence, rollback, and escalation. On failure it produces structured evidence-grounded diagnosis. Codex accelerated implementation, tests, debugging, evaluation, and documentation. Humans retained product, safety, approval, and deterministic-verdict decisions.
