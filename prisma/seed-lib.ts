import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  db,
  findWorkspaceRoot,
  parseRunbook,
  setDemoState,
} from "@flowproof/core";
import { initialDemoStates, regressionKeys } from "@flowproof/fixtures";

const files = [
  "offboard-contractor.yml",
  "refund-customer.yml",
  "access-policy-drift.yml",
];

export async function seedDatabase(resetDemo: boolean): Promise<void> {
  const root = findWorkspaceRoot();
  for (const file of files) {
    const yaml = await readFile(
      path.join(root, "fixtures/runbooks", file),
      "utf8",
    );
    const runbook = parseRunbook(yaml);
    await db.runbook.upsert({
      where: { slug: runbook.slug },
      create: {
        slug: runbook.slug,
        name: runbook.name,
        description: runbook.description,
        severity: runbook.severity,
        yaml,
      },
      update: {
        name: runbook.name,
        description: runbook.description,
        severity: runbook.severity,
        yaml,
      },
    });
  }
  if (resetDemo)
    await db.regression.deleteMany({
      where: { key: { notIn: [...regressionKeys] } },
    });
  for (const key of regressionKeys)
    await db.regression.upsert({
      where: { key },
      create: { key, enabled: false },
      update: resetDemo ? { enabled: false } : {},
    });
  for (const [key, value] of Object.entries(initialDemoStates)) {
    if (resetDemo) await setDemoState(key, value);
    else
      await db.demoState.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value) },
        update: {},
      });
  }
  console.log(
    `${resetDemo ? "Reset" : "Ensured"} ${files.length} runbooks, ${regressionKeys.length} regression controls, and demo state.`,
  );
}
