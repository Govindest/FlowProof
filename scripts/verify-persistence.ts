import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = await mkdtemp(path.join(tmpdir(), "flowproof-persistence-"));
const port = 32_890;
const baseUrl = `http://127.0.0.1:${port}`;
const secret = "flowproof-persistence-test-secret";
let service: ChildProcess | undefined;

const environment = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(port),
  FLOWPROOF_PUBLIC_BASE_URL: baseUrl,
  FLOWPROOF_ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  FLOWPROOF_BACKEND_SHARED_SECRET: secret,
  DATABASE_URL: `file:${path.join(dataDir, "flowproof.db")}`,
  FLOWPROOF_ARTIFACT_DIR: path.join(dataDir, "artifacts"),
  DEMO_BASE_URL: "http://127.0.0.1:3100",
  FLOWPROOF_LLM_MODE: "seeded",
  FLOWPROOF_LLM_MODEL: "gpt-5.6",
  OPENAI_API_KEY: "",
};

const build = spawnSync(
  "pnpm",
  ["--filter", "@flowproof/demo-suite", "build"],
  { cwd: root, env: environment, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);

async function waitForReady(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/ready`);
      if (response.ok) return;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Production entrypoint did not become ready within 30s");
}

async function start(): Promise<void> {
  service = spawn("pnpm", ["start:railway"], {
    cwd: root,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  service.stdout?.on("data", () => undefined);
  service.stderr?.on("data", () => undefined);
  await waitForReady();
}

async function stop(): Promise<void> {
  if (!service?.pid) return;
  const current = service;
  if (process.platform === "win32") current.kill("SIGTERM");
  else process.kill(-current.pid, "SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => current.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
  ]);
  service = undefined;
}

async function api<T>(pathname: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.method === "POST") {
    headers.set("content-type", "application/json");
    headers.set("x-flowproof-secret", secret);
  }
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
  assert.equal(response.ok, true, `${pathname} returned ${response.status}`);
  return response.json() as Promise<T>;
}

type Run = {
  id: string;
  status: string;
  artifactPath: string | null;
  tracePath: string | null;
  resultJson: string | null;
};

async function waitForRun(id: string, expected: "FAIL" | "PASS") {
  const states = new Set(["QUEUED"]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const run = await api<Run>(`/api/runs/${id}`);
    states.add(run.status);
    if (run.status === expected) return { run, states: [...states] };
    if (run.status === "FAIL" || run.status === "PASS")
      throw new Error(`Run ${id} ended ${run.status}, expected ${expected}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Run ${id} did not finish`);
}

async function artifact(pathname: string): Promise<Response> {
  const response = await fetch(`${baseUrl}/api/artifacts/${pathname}`);
  assert.equal(response.ok, true, `Artifact ${pathname} unavailable`);
  assert.ok((await response.arrayBuffer()).byteLength > 0);
  return response;
}

try {
  await start();
  assert.equal((await api<{ status: string }>("/health")).status, "ok");

  const queuedFail = await api<{ id: string; status: string }>("/api/demo", {
    method: "POST",
    body: "{}",
  });
  assert.equal(queuedFail.status, "QUEUED");
  const failed = await waitForRun(queuedFail.id, "FAIL");
  assert.ok(failed.states.includes("RUNNING"));
  const failedResult = JSON.parse(failed.run.resultJson ?? "null") as {
    invariants: Array<{ id: string; status: string }>;
    steps: Array<{ screenshot: string }>;
  };
  assert.ok(
    failedResult.invariants.some(
      (item) => item.id === "membership-removed" && item.status === "FAIL",
    ),
  );

  const queuedPass = await api<{ id: string; status: string }>(
    `/api/runs/${queuedFail.id}/recover`,
    { method: "POST", body: "{}" },
  );
  assert.equal(queuedPass.status, "QUEUED");
  const passed = await waitForRun(queuedPass.id, "PASS");
  assert.ok(passed.states.includes("RUNNING"));

  await stop();
  await start();

  const historicalFail = await api<Run>(`/api/runs/${queuedFail.id}`);
  const historicalPass = await api<Run>(`/api/runs/${queuedPass.id}`);
  assert.equal(historicalFail.status, "FAIL");
  assert.equal(historicalPass.status, "PASS");
  const runDirectory = historicalFail.artifactPath!;
  await artifact(
    failedResult.steps.find((step) => step.screenshot)!.screenshot,
  );
  await artifact(historicalFail.tracePath!);
  await artifact(`${runDirectory}/result.json`);
  await artifact(`${runDirectory}/evidence.md`);
  await artifact(`${runDirectory}/issue-draft.json`);
  const fixtures =
    await api<Array<{ key: string; enabled: boolean }>>("/api/fixtures");
  assert.equal(
    fixtures.find((item) => item.key === "offboard.permission-drift")?.enabled,
    false,
  );

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        failRunId: queuedFail.id,
        passRunId: queuedPass.id,
        failStates: failed.states,
        passStates: passed.states,
        restartPersistence: true,
        artifactsVerified: [
          "screenshot",
          "trace.zip",
          "result.json",
          "evidence.md",
          "issue-draft.json",
        ],
        fixtureStateAfterRestart: "repaired",
      },
      null,
      2,
    ),
  );
} finally {
  await stop();
  await rm(dataDir, { recursive: true, force: true });
}
