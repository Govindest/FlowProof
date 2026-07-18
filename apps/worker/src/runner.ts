import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import {
  buildEvidenceMarkdown,
  buildIssueDraft,
  db,
  diagnoseFailure,
  evaluateInvariant,
  getArtifactRoot,
  getLanguageModel,
  parseRunbook,
  setDemoState,
  type Invariant,
  type InvariantResult,
  type RunResult,
  type RunbookStep,
  type StepResult,
} from "@flowproof/core";
import { initialDemoStates } from "@flowproof/fixtures";
import { createGitHubIssue } from "@flowproof/github";

async function resetDemo(): Promise<void> {
  for (const [key, value] of Object.entries(initialDemoStates))
    await setDemoState(key, structuredClone(value));
  const unexpected = await db.regression.findUnique({
    where: { key: "evaluation.unexpected-initial-state" },
  });
  if (unexpected?.enabled) {
    const state = {
      ...structuredClone(initialDemoStates.billing),
      order: {
        ...structuredClone(initialDemoStates.billing.order),
        status: "refunded",
      },
    };
    await setDemoState("billing", state);
  }
}

async function evaluateConditions(
  conditions: Invariant[],
  baseUrl: string,
): Promise<InvariantResult[]> {
  return Promise.all(
    conditions.map(async (condition) => {
      try {
        const response = await fetch(new URL(condition.endpoint, baseUrl));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return evaluateInvariant(condition, await response.json());
      } catch (error) {
        return {
          id: condition.id,
          name: condition.name,
          status: "FAIL" as const,
          expected: condition.expected,
          actual: null,
          message: cleanError(error),
        };
      }
    }),
  );
}

async function runStep(
  page: Page,
  step: RunbookStep,
  baseUrl: string,
): Promise<void> {
  if (step.action === "goto")
    await page.goto(new URL(step.path!, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: step.timeoutMs,
    });
  if (step.action === "click")
    await page.locator(step.selector!).click({ timeout: step.timeoutMs });
  if (step.action === "fill")
    await page
      .locator(step.selector!)
      .fill(step.value!, { timeout: step.timeoutMs });
  if (step.action === "assertText")
    await page
      .locator(step.selector!)
      .filter({ hasText: step.expected! })
      .waitFor({ state: "visible", timeout: step.timeoutMs });
}

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0]?.slice(0, 240) ?? "Unknown browser error";
}

export async function executeRun(
  runId: string,
  baseUrl = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3100",
): Promise<RunResult> {
  const record = await db.run.findUnique({
    where: { id: runId },
    include: { runbook: true },
  });
  if (!record) throw new Error(`Run ${runId} not found`);
  const runbook = parseRunbook(record.runbook.yaml);
  const started = new Date();
  const relativeArtifactDir = path.join("runs", runId);
  const artifactDir = path.join(getArtifactRoot(), relativeArtifactDir);
  const traceRelative = path.join(relativeArtifactDir, "trace.zip");
  await mkdir(artifactDir, { recursive: true });
  await resetDemo();
  await db.run.update({
    where: { id: runId },
    data: {
      status: "RUNNING",
      startedAt: started,
      artifactPath: relativeArtifactDir,
      tracePath: traceRelative,
    },
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  const page = await context.newPage();
  const steps: StepResult[] = [];
  const preconditions = await evaluateConditions(
    runbook.preconditions,
    baseUrl,
  );
  let stopped = preconditions.some((item) => item.status === "FAIL");

  try {
    if (stopped) {
      const firstPage =
        runbook.steps.find((step) => step.action === "goto")?.path ?? "/";
      const screenshot = path.join(
        relativeArtifactDir,
        "00-precondition-state.png",
      );
      await page.goto(new URL(firstPage, baseUrl).toString(), {
        waitUntil: "networkidle",
      });
      await page.screenshot({
        path: path.join(artifactDir, "00-precondition-state.png"),
        fullPage: true,
      });
      steps.push({
        id: "precondition-evidence",
        name: "Capture unexpected initial state",
        status: "PASS",
        durationMs: 0,
        screenshot,
      });
    }
    for (const [index, step] of runbook.steps.entries()) {
      if (stopped) {
        steps.push({
          id: step.id,
          name: step.name,
          status: "SKIPPED",
          durationMs: 0,
          screenshot: "",
        });
        continue;
      }
      const stepStarted = performance.now();
      const screenshotFile = `${String(index + 1).padStart(2, "0")}-${step.id}.png`;
      const screenshotRelative = path.join(relativeArtifactDir, screenshotFile);
      try {
        await runStep(page, step, baseUrl);
        await page.screenshot({
          path: path.join(artifactDir, screenshotFile),
          fullPage: true,
        });
        steps.push({
          id: step.id,
          name: step.name,
          status: "PASS",
          durationMs: Math.round(performance.now() - stepStarted),
          screenshot: screenshotRelative,
        });
      } catch (error) {
        await page
          .screenshot({
            path: path.join(artifactDir, screenshotFile),
            fullPage: true,
          })
          .catch(() => undefined);
        steps.push({
          id: step.id,
          name: step.name,
          status: "FAIL",
          durationMs: Math.round(performance.now() - stepStarted),
          screenshot: screenshotRelative,
          error: cleanError(error),
        });
        stopped = true;
      }
    }
  } finally {
    await context.tracing.stop({ path: path.join(artifactDir, "trace.zip") });
    await browser.close();
  }

  const invariants = await evaluateConditions(runbook.invariants, baseUrl);

  const status =
    preconditions.some((item) => item.status === "FAIL") ||
    steps.some((step) => step.status === "FAIL") ||
    invariants.some((item) => item.status === "FAIL")
      ? "FAIL"
      : "PASS";
  const completed = new Date();
  const durationMs = completed.getTime() - started.getTime();
  const violatedInvariant =
    preconditions.find((item) => item.status === "FAIL") ??
    invariants.find((item) => item.status === "FAIL") ??
    null;
  const diagnosis =
    status === "FAIL"
      ? await diagnoseFailure({
          runbookName: record.runbook.name,
          severity: record.runbook.severity,
          failedStep: steps.find((step) => step.status === "FAIL") ?? null,
          violatedInvariant,
          steps,
          invariants: [...preconditions, ...invariants],
          tracePath: traceRelative,
        })
      : null;
  const explanation =
    diagnosis?.rootCause ??
    (await getLanguageModel().generateText({
      system: "Summarize a successful workflow verification.",
      prompt: "Status PASS",
    }));
  const reportBase = {
    id: runId,
    status,
    runbook: {
      id: record.runbook.id,
      slug: record.runbook.slug,
      name: record.runbook.name,
      severity: record.runbook.severity,
    },
    durationMs,
    steps,
    preconditions,
    invariants,
    tracePath: traceRelative,
    explanation,
    diagnosis,
  } as const;
  const issueDraft = buildIssueDraft(reportBase);
  const result: RunResult = {
    ...reportBase,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    issueDraft,
  };
  const evidenceMarkdown = buildEvidenceMarkdown(reportBase);

  await Promise.all([
    writeFile(
      path.join(artifactDir, "result.json"),
      JSON.stringify(result, null, 2),
    ),
    writeFile(path.join(artifactDir, "evidence.md"), evidenceMarkdown),
    writeFile(
      path.join(artifactDir, "issue-draft.json"),
      JSON.stringify(issueDraft, null, 2),
    ),
  ]);
  await db.run.update({
    where: { id: runId },
    data: {
      status,
      completedAt: completed,
      durationMs,
      stepsJson: JSON.stringify(steps),
      invariantsJson: JSON.stringify(invariants),
      resultJson: JSON.stringify(result),
      explanation,
      evidenceMarkdown,
      issueDraftJson: issueDraft ? JSON.stringify(issueDraft) : null,
    },
  });
  if (issueDraft) {
    const [storedToken, storedRepository] = await Promise.all([
      db.setting.findUnique({ where: { key: "github.token" } }),
      db.setting.findUnique({ where: { key: "github.repository" } }),
    ]);
    await createGitHubIssue(
      issueDraft,
      storedToken?.value ?? process.env.GITHUB_TOKEN,
      storedRepository?.value ?? process.env.GITHUB_REPOSITORY,
    ).catch((error) => console.error(cleanError(error)));
  }
  return result;
}
