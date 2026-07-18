import { db } from "@flowproof/core";
import { executeRun } from "./runner";

let active = true;

export function publicWorkerFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/browserType\.launch|executable doesn't exist|chromium/i.test(message))
    return "Browser worker could not start Chromium. Review worker configuration and deployment logs.";
  return "Workflow execution failed before an evidence packet could be completed. Review worker logs.";
}

export async function processNextJob(): Promise<boolean> {
  const queued = await db.job.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!queued) return false;
  const claim = await db.job.updateMany({
    where: { id: queued.id, status: "QUEUED" },
    data: { status: "RUNNING", claimedAt: new Date() },
  });
  if (!claim.count) return false;
  try {
    await executeRun(queued.runId);
    await db.job.update({
      where: { id: queued.id },
      data: { status: "COMPLETE" },
    });
  } catch (error) {
    const message = publicWorkerFailure(error);
    await db.$transaction([
      db.job.update({
        where: { id: queued.id },
        data: { status: "FAILED", error: message },
      }),
      db.run.update({
        where: { id: queued.runId },
        data: {
          status: "FAIL",
          completedAt: new Date(),
          explanation: message,
        },
      }),
    ]);
  }
  return true;
}

async function main() {
  console.log("FlowProof worker ready");
  while (active) {
    const worked = await processNextJob();
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  await db.$disconnect();
}

if (process.argv[1]?.endsWith("worker.ts")) {
  process.on("SIGINT", () => {
    active = false;
  });
  process.on("SIGTERM", () => {
    active = false;
  });
  void main();
}
