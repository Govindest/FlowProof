import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, type BackendConfig } from "@flowproof/core";
import { createBackendServer } from "../src/server";

const sharedSecret = "backend-test-shared-secret";
let baseUrl = "";
let artifactDir = "";
const config: BackendConfig = {
  nodeEnv: "test",
  port: 0,
  publicBaseUrl: "http://127.0.0.1",
  allowedOrigins: ["https://flowproof.vercel.app"],
  sharedSecret,
  artifactDir: "",
  demoBaseUrl: "http://127.0.0.1:3100",
};
const server = createBackendServer(config);

beforeAll(async () => {
  expect(await db.runbook.count()).toBeGreaterThan(0);
  artifactDir = await mkdtemp(path.join(tmpdir(), "flowproof-backend-"));
  config.artifactDir = artifactDir;
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await db.$disconnect();
});

describe("Railway backend boundary", () => {
  it("serves health and readiness without calling OpenAI", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "ok",
      llm: { model: "gpt-5.6", mode: "seeded" },
    });
    const ready = await fetch(`${baseUrl}/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({
      status: "ready",
      checks: { database: "ok", artifactDirectory: "writable" },
    });
  });

  it("rejects missing and invalid secrets on mutations", async () => {
    const missing = await fetch(`${baseUrl}/api/fixtures/reset`, {
      method: "POST",
    });
    expect(missing.status).toBe(401);
    const invalid = await fetch(`${baseUrl}/api/fixtures/reset`, {
      method: "POST",
      headers: { "x-flowproof-secret": "wrong-secret-value" },
    });
    expect(invalid.status).toBe(401);
  });

  it("accepts the configured Vercel origin and rejects another origin", async () => {
    const allowed = await fetch(`${baseUrl}/health`, {
      headers: { origin: "https://flowproof.vercel.app" },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://flowproof.vercel.app",
    );
    const rejected = await fetch(`${baseUrl}/health`, {
      headers: { origin: "https://attacker.example" },
    });
    expect(rejected.status).toBe(403);
  });

  it("queues work quickly through the remote API contract", async () => {
    const dashboard = (await (
      await fetch(`${baseUrl}/api/dashboard`)
    ).json()) as { runbooks: Array<{ id: string; slug: string }> };
    const offboard = dashboard.runbooks.find(
      (runbook) => runbook.slug === "offboard-contractor",
    );
    const response = await fetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowproof-secret": sharedSecret,
      },
      body: JSON.stringify({ runbookId: offboard?.id }),
    });
    expect(response.status).toBe(202);
    const queued = (await response.json()) as { id: string; status: string };
    expect(queued).toMatchObject({ status: "QUEUED" });
    await db.run.delete({ where: { id: queued.id } });
  });

  it("serves only artifacts owned by a known run and blocks traversal", async () => {
    const runbook = await db.runbook.findUniqueOrThrow({
      where: { slug: "offboard-contractor" },
    });
    const run = await db.run.create({
      data: {
        runbookId: runbook.id,
        artifactPath: "placeholder",
      },
    });
    const relative = path.join("runs", run.id);
    await db.run.update({
      where: { id: run.id },
      data: { artifactPath: relative },
    });
    await mkdir(path.join(artifactDir, relative), { recursive: true });
    await writeFile(path.join(artifactDir, relative, "proof.png"), "proof");
    const valid = await fetch(
      `${baseUrl}/api/artifacts/runs/${run.id}/proof.png`,
    );
    expect(valid.status).toBe(200);
    const traversal = await fetch(
      `${baseUrl}/api/artifacts/runs/${run.id}/%2e%2e/secret.txt`,
    );
    expect(traversal.status).not.toBe(200);
  });
});
