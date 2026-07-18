import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, type RunResult } from "@flowproof/core";
import { regressionKeys } from "@flowproof/fixtures";
import { executeRun } from "../src/runner";

let server: ChildProcess | undefined;

async function waitForDemo() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:3100/api/demo/identity")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Demo suite did not start");
}

beforeAll(async () => {
  try {
    const response = await fetch("http://127.0.0.1:3100/api/demo/identity");
    if (!response.ok) throw new Error("Demo unavailable");
  } catch {
    server = spawn("pnpm", ["--filter", "@flowproof/demo-suite", "dev"], {
      cwd: path.resolve(import.meta.dirname, "../../.."),
      stdio: "ignore",
    });
    await waitForDemo();
  }
}, 60_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await db.$disconnect();
});

async function verify(slug: string, regression?: string): Promise<RunResult> {
  for (const key of regressionKeys)
    await db.regression.update({
      where: { key },
      data: { enabled: key === regression },
    });
  const runbook = await db.runbook.findUniqueOrThrow({ where: { slug } });
  const run = await db.run.create({ data: { runbookId: runbook.id } });
  return executeRun(run.id);
}

describe.sequential("seeded browser workflows", () => {
  for (const slug of [
    "offboard-contractor",
    "refund-customer",
    "access-policy-drift",
  ]) {
    it(`${slug} passes in clean mode`, async () =>
      expect((await verify(slug)).status).toBe("PASS"));
  }

  for (const [slug, regression, invariant] of [
    ["offboard-contractor", "offboard.permission-drift", "membership-removed"],
    ["refund-customer", "refund.missing-side-effect", "note-created"],
    ["access-policy-drift", "policy.incorrect-state", "forbidden-state"],
  ] as const) {
    it(`${slug} fails with deterministic regression`, async () => {
      const result = await verify(slug, regression);
      expect(result.status).toBe("FAIL");
      expect(
        result.invariants.find((item) => item.id === invariant)?.status,
      ).toBe("FAIL");
      expect(result.diagnosis).toMatchObject({
        model: "gpt-5.6",
        providerMode: "seeded",
      });
      expect(result.diagnosis?.evidenceReferences).toContain(
        `invariant:${invariant}`,
      );
      expect(result.issueDraft).not.toBeNull();
      await access(
        path.resolve(
          import.meta.dirname,
          "../../../artifacts",
          result.tracePath,
        ),
      );
    });
  }
});
