# FlowProof hosted demo video plan — 2:45 target

Record only after both public services pass the judge path. Replace placeholders
with verified URLs before recording:

- Dashboard: `<VERCEL_URL>`
- Backend health: `<RAILWAY_URL>/health`
- Backup FAIL report: `<VERCEL_URL>/runs/<SEEDED_FAIL_RUN_ID>`
- Backup PASS report: `<VERCEL_URL>/runs/<SEEDED_PASS_RUN_ID>`

## Browser setup

1. Use a clean Chrome or Edge profile at 1440×900 or larger.
2. Hide bookmarks and personal extensions; disable notifications.
3. Open dashboard, fixture controls, backup FAIL, and backup PASS in four tabs.
4. Reset demo, pre-run one hosted FAIL and recovery PASS, then verify artifact
   links remain available.
5. Confirm microphone level, system audio policy, cursor visibility, and 1080p
   recording.
6. Keep seeded GPT-5.6 mode as backup if live API becomes unavailable.

## Shot list and voiceover

### 0:00–0:18 — Problem

**Shot:** Hosted dashboard hero, backend-online badge, three runbooks.

**Voiceover:** “Deployments can be green while offboarding, refunds, and access
policies silently fail. FlowProof is CI for business operations: it replays the
browser workflow, verifies the real business outcome, and keeps evidence when
it breaks.”

### 0:18–0:38 — Inject failure

**Shot:** Fixture control. Enable Repository permission drift, or click Run
failure demo.

**Voiceover:** “This seeded contractor starts active. Permission drift makes
the repository-revocation action look successful while membership remains.
These demo systems affect no real account.”

### 0:38–1:02 — Queued browser run

**Shot:** Run page visibly moves QUEUED, RUNNING, FAIL.

**Voiceover:** “The Vercel dashboard queues work on Railway. A persistent worker
runs Chromium, captures every step and a Playwright trace, then checks typed
business invariants against authoritative state.”

### 1:02–1:38 — Proof and GPT-5.6

**Shot:** FAIL banner; `membership-removed`; screenshot; trace button; evidence
links; diagnosis.

**Voiceover:** “Browser steps completed, but deterministic invariant
membership-removed failed. Screenshot and trace preserve what happened. GPT-5.6
then diagnoses only from structured artifacts, cites the evidence, explains
business impact, and recommends a procedure change. GPT never decides PASS or
FAIL.”

### 1:38–2:02 — Repair and recovery

**Shot:** Click Repair & rerun; show fresh PASS banner.

**Voiceover:** “Repair resets permission drift and queues a fresh proof run.
FlowProof closes the loop only after the rerun proves identity disablement,
login denial, and repository removal.”

### 2:02–2:27 — Evaluation and compiler

**Shot:** Dashboard evaluation strip; briefly open New runbook natural-language
tab.

**Voiceover:** “Six executed cases cover UI drift, missing side effects,
permission drift, bad initial state, wrong sequence, and a cosmetic control.
GPT-5.6 also compiles plain-language SOPs into typed steps, conditions,
invariants, evidence, rollback, and escalation.”

### 2:27–2:45 — Codex and impact

**Shot:** Return to dashboard and comparison link.

**Voiceover:** “Codex accelerated implementation, tests, debugging, evaluation,
and deployment hardening. Humans retained product, safety, approval, and
architecture decisions. FlowProof turns brittle operational trust into
repeatable evidence.”

## Backup path

If live GPT-5.6 fails during recording, switch Railway to
`FLOWPROOF_LLM_MODE=seeded`, redeploy, and use the preverified FAIL/PASS report
tabs. Label stays visibly “Seeded demo output”; deterministic verdict and
evidence remain real. Do not splice localhost footage into hosted demo.

To stay under three minutes, record one take, avoid terminal footage, keep
screenshot inspection to one artifact, and use pre-opened report tabs if host
startup is slow. User must review recording before public YouTube upload.
