import type {
  Diagnosis,
  InvariantResult,
  IssueDraft,
  RunResult,
  StepResult,
} from "./schema";

type ReportInput = Pick<
  RunResult,
  "id" | "status" | "runbook" | "durationMs" | "tracePath" | "explanation"
> & {
  steps: StepResult[];
  preconditions: InvariantResult[];
  invariants: InvariantResult[];
  diagnosis: Diagnosis | null;
};

export function buildEvidenceMarkdown(run: ReportInput): string {
  const failedSteps = run.steps.filter((step) => step.status === "FAIL");
  const failedPreconditions = run.preconditions.filter(
    (item) => item.status === "FAIL",
  );
  const failedInvariants = run.invariants.filter(
    (item) => item.status === "FAIL",
  );
  return [
    `# FlowProof evidence: ${run.runbook.name}`,
    "",
    `**Result:** ${run.status}  `,
    `**Run:** \`${run.id}\`  `,
    `**Duration:** ${(run.durationMs / 1000).toFixed(1)}s`,
    "",
    "## Summary",
    run.explanation,
    "",
    "## Failing steps",
    failedSteps.length
      ? failedSteps
          .map(
            (step) =>
              `- ${step.name}: ${step.error ?? "failed"} (${step.screenshot})`,
          )
          .join("\n")
      : "- None",
    "",
    "## Failing preconditions",
    failedPreconditions.length
      ? failedPreconditions
          .map((item) => `- ${item.name}: ${item.message}`)
          .join("\n")
      : "- None",
    "",
    "## Failing invariants",
    failedInvariants.length
      ? failedInvariants
          .map((item) => `- ${item.name}: ${item.message}`)
          .join("\n")
      : "- None",
    "",
    "## Diagnosis",
    run.diagnosis
      ? `- Provider: ${run.diagnosis.providerMode === "live" ? "Live" : "Seeded"} ${run.diagnosis.model}\n- Root cause: ${run.diagnosis.rootCause}\n- Business impact: ${run.diagnosis.businessImpact}\n- Confidence: ${Math.round(run.diagnosis.confidence * 100)}%\n- Evidence: ${run.diagnosis.evidenceReferences.join(", ")}`
      : "- Not required for PASS",
    "",
    "## Artifacts",
    `- Playwright trace: ${run.tracePath}`,
    ...run.steps.map((step) => `- ${step.name}: ${step.screenshot}`),
  ].join("\n");
}

export function buildIssueDraft(run: ReportInput): IssueDraft | null {
  if (run.status === "PASS") return null;
  const failures = [...run.preconditions, ...run.invariants].filter(
    (item) => item.status === "FAIL",
  );
  return {
    title: `[FlowProof] ${run.runbook.name} verification failed`,
    body: `${run.explanation}\n\n### Failed checks\n${failures.map((item) => `- **${item.name}** — ${item.message}`).join("\n")}\n\n### Evidence-grounded diagnosis\n${run.diagnosis ? `${run.diagnosis.rootCause}\n\nEvidence: ${run.diagnosis.evidenceReferences.join(", ")}` : "Unavailable"}\n\nRun ID: \`${run.id}\``,
    labels: ["flowproof", `severity:${run.runbook.severity}`],
    attachments: [run.tracePath, ...run.steps.map((step) => step.screenshot)],
  };
}
