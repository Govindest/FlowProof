import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, type RunResult } from "@flowproof/core";
import { regressionKeys } from "@flowproof/fixtures";
import { executeRun } from "../apps/worker/src/runner";

// Evaluation is a deterministic benchmark, independent of an operator's live .env.
process.env.FLOWPROOF_LLM_MODE = "seeded";
process.env.FLOWPROOF_MOCK = "true";

const root = path.resolve(import.meta.dirname, "..");
let server: ChildProcess | undefined;

const cases = [
  {
    id: "ui-drift",
    category: "UI drift",
    slug: "offboard-contractor",
    regression: "evaluation.ui-drift",
    expectedResult: "FAIL",
    expectedInvariant: "identity-disabled",
  },
  {
    id: "missing-side-effect",
    category: "Missing business side effect",
    slug: "refund-customer",
    regression: "refund.missing-side-effect",
    expectedResult: "FAIL",
    expectedInvariant: "note-created",
  },
  {
    id: "permission-drift",
    category: "Permission drift",
    slug: "offboard-contractor",
    regression: "offboard.permission-drift",
    expectedResult: "FAIL",
    expectedInvariant: "membership-removed",
  },
  {
    id: "unexpected-initial-state",
    category: "Unexpected initial state",
    slug: "refund-customer",
    regression: "evaluation.unexpected-initial-state",
    expectedResult: "FAIL",
    expectedInvariant: "order-paid",
  },
  {
    id: "incorrect-step-sequence",
    category: "Incorrect step sequence",
    slug: "refund-customer",
    regression: "evaluation.incorrect-sequence",
    expectedResult: "FAIL",
    expectedInvariant: "sequence-valid",
  },
  {
    id: "cosmetic-change",
    category: "Non-breaking cosmetic change",
    slug: "offboard-contractor",
    regression: "evaluation.cosmetic-change",
    expectedResult: "PASS",
    expectedInvariant: null,
  },
] as const;

async function demoReady() {
  try {
    return (await fetch("http://127.0.0.1:3100/api/demo/identity")).ok;
  } catch {
    return false;
  }
}

async function waitForDemo() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await demoReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Demo suite did not start within 30 seconds");
}

async function setRegression(active: string) {
  for (const key of regressionKeys)
    await db.regression.update({
      where: { key },
      data: { enabled: key === active },
    });
}

async function evidenceComplete(result: RunResult) {
  const screenshots = result.steps.filter((step) => step.screenshot);
  try {
    await access(path.join(root, "artifacts", result.tracePath));
    await Promise.all(
      screenshots.map((step) =>
        access(path.join(root, "artifacts", step.screenshot)),
      ),
    );
    return screenshots.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await demoReady())) {
    server = spawn("pnpm", ["--filter", "@flowproof/demo-suite", "dev"], {
      cwd: root,
      stdio: "ignore",
    });
    await waitForDemo();
  }

  const results = [];
  for (const item of cases) {
    await setRegression(item.regression);
    const runbook = await db.runbook.findUniqueOrThrow({
      where: { slug: item.slug },
    });
    const run = await db.run.create({ data: { runbookId: runbook.id } });
    const result = await executeRun(run.id);
    const checks = [...result.preconditions, ...result.invariants];
    const expectedCheck = item.expectedInvariant
      ? checks.find((check) => check.id === item.expectedInvariant)
      : undefined;
    const evidenceCaptured = await evidenceComplete(result);
    const diagnosisReferencesEvidence = result.diagnosis
      ? result.diagnosis.evidenceReferences.includes(result.tracePath) &&
        (!item.expectedInvariant ||
          result.diagnosis.evidenceReferences.includes(
            `invariant:${item.expectedInvariant}`,
          ))
      : null;
    results.push({
      id: item.id,
      category: item.category,
      regression: item.regression,
      runbook: item.slug,
      runId: result.id,
      expectedResult: item.expectedResult,
      observedResult: result.status,
      expectationMet: result.status === item.expectedResult,
      faultDetected:
        item.expectedResult === "FAIL" ? result.status === "FAIL" : false,
      expectedInvariant: item.expectedInvariant,
      observedViolatedInvariants: checks
        .filter((check) => check.status === "FAIL")
        .map((check) => check.id),
      correctInvariantIdentified: item.expectedInvariant
        ? expectedCheck?.status === "FAIL" &&
          result.diagnosis?.violatedInvariant === expectedCheck.name
        : null,
      requiredEvidenceCaptured: evidenceCaptured,
      diagnosisReferencedRelevantEvidence: diagnosisReferencesEvidence,
      diagnosisProvider: result.diagnosis?.providerMode ?? null,
      executionDurationMs: result.durationMs,
      artifactPath: `artifacts/runs/${result.id}`,
    });
    console.log(
      `${item.id}: expected ${item.expectedResult}, observed ${result.status} (${result.durationMs}ms)`,
    );
  }

  await setRegression("");
  const failedCases = results.filter((item) => item.expectedResult === "FAIL");
  const output = {
    generatedAt: new Date().toISOString(),
    model: "gpt-5.6",
    providerMode: process.env.FLOWPROOF_MOCK === "false" ? "live" : "seeded",
    summary: {
      totalCases: results.length,
      expectationsMet: results.filter((item) => item.expectationMet).length,
      faultsDetected: failedCases.filter((item) => item.faultDetected).length,
      correctInvariantIdentifications: failedCases.filter(
        (item) => item.correctInvariantIdentified,
      ).length,
      evidencePacketsComplete: results.filter(
        (item) => item.requiredEvidenceCaptured,
      ).length,
      diagnosesReferencingEvidence: failedCases.filter(
        (item) => item.diagnosisReferencedRelevantEvidence,
      ).length,
      averageDurationMs: Math.round(
        results.reduce((total, item) => total + item.executionDurationMs, 0) /
          results.length,
      ),
    },
    cases: results,
  };
  await mkdir(path.join(root, "evaluation"), { recursive: true });
  await writeFile(
    path.join(root, "evaluation/results.json"),
    `${JSON.stringify(output, null, 2)}\n`,
  );
  const markdown = [
    "# FlowProof evaluation",
    "",
    `Generated ${output.generatedAt} by executing real Playwright runs in ${output.providerMode} diagnosis mode.`,
    "",
    "## Measured summary",
    "",
    `- Expected outcomes observed: **${output.summary.expectationsMet}/${output.summary.totalCases}**`,
    `- Breaking faults detected: **${output.summary.faultsDetected}/${failedCases.length}**`,
    `- Correct invariant identified: **${output.summary.correctInvariantIdentifications}/${failedCases.length}**`,
    `- Complete screenshot + trace evidence: **${output.summary.evidencePacketsComplete}/${output.summary.totalCases}**`,
    `- Failure diagnoses citing relevant evidence: **${output.summary.diagnosesReferencingEvidence}/${failedCases.length}**`,
    `- Mean browser execution duration: **${output.summary.averageDurationMs}ms**`,
    "",
    "## Executed cases",
    "",
    "| Case | Expected | Observed | Correct invariant | Evidence | Diagnosis cites evidence | Duration |",
    "| --- | --- | --- | --- | --- | --- | ---: |",
    ...results.map(
      (item) =>
        `| ${item.category} | ${item.expectedResult} | ${item.observedResult} | ${item.correctInvariantIdentified === null ? "N/A" : item.correctInvariantIdentified ? "Yes" : "No"} | ${item.requiredEvidenceCaptured ? "Complete" : "Incomplete"} | ${item.diagnosisReferencedRelevantEvidence === null ? "N/A" : item.diagnosisReferencedRelevantEvidence ? "Yes" : "No"} | ${item.executionDurationMs}ms |`,
    ),
    "",
    "## Method",
    "",
    "Each case resets authoritative demo state, enables one seeded regression, executes the stored runbook in Chromium, evaluates typed preconditions and invariants, verifies artifact files on disk, and checks diagnosis evidence references. The cosmetic control must remain PASS. GPT-5.6 or seeded diagnosis never determines the verdict.",
    "",
    "Machine-readable source: [`evaluation/results.json`](evaluation/results.json). Reproduce with `pnpm seed && pnpm evaluate`.",
    "",
  ].join("\n");
  await writeFile(path.join(root, "EVALUATION.md"), markdown);
  console.log(
    `Wrote evaluation/results.json with ${output.summary.expectationsMet}/${output.summary.totalCases} expected outcomes.`,
  );
}

try {
  await main();
} finally {
  server?.kill("SIGTERM");
  await db.$disconnect();
}
