import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  compileNaturalLanguage,
  db,
  getBackendConfig,
  getLlmConfiguration,
  parseRunbook,
  setDemoState,
  stringifyRunbook,
  type BackendConfig,
} from "@flowproof/core";
import { initialDemoStates, regressionKeys } from "@flowproof/fixtures";
import { z } from "zod";
import evaluationData from "../../../evaluation/results.json";
import { corsHeaders, hasValidSharedSecret } from "./security";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const contentTypes: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".zip": "application/zip",
};
const regressionSchema = z.object({
  key: z.enum(regressionKeys),
  enabled: z.boolean(),
});
const runSchema = z.object({ runbookId: z.string().min(1).max(100) });
const compileSchema = z.object({ prompt: z.string().trim().min(3).max(5_000) });
const runbookInputSchema = z.object({ yaml: z.string().min(10).max(100_000) });
const settingSchema = z.object({
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  token: z.string().min(8).max(500).optional(),
});

type ResponseHeaders = Record<string, string>;

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: ResponseHeaders = {},
): void {
  response.writeHead(status, { ...jsonHeaders, ...headers });
  response.end(JSON.stringify(body));
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  headers: ResponseHeaders = {},
): void {
  sendJson(response, status, { error: { code, message } }, headers);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 128_000) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function resetDemo(): Promise<void> {
  await db.regression.updateMany({ data: { enabled: false } });
  for (const [key, value] of Object.entries(initialDemoStates))
    await setDemoState(key, structuredClone(value));
}

async function queueRun(runbookId: string) {
  const runbook = await db.runbook.findUnique({ where: { id: runbookId } });
  if (!runbook) return null;
  return db.run.create({
    data: { runbookId, job: { create: {} } },
    select: { id: true, status: true, createdAt: true },
  });
}

async function dashboard() {
  const [runbooks, recent] = await Promise.all([
    db.runbook.findMany({
      orderBy: { createdAt: "asc" },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.run.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { runbook: true },
    }),
  ]);
  return {
    runbooks,
    recent,
    evaluation: evaluationData,
    backend: { status: "available", llm: getLlmConfiguration() },
  };
}

async function serveArtifact(
  pathname: string,
  response: ServerResponse,
  headers: ResponseHeaders,
  config: BackendConfig,
): Promise<void> {
  const prefix = "/api/artifacts/";
  const relative = decodeURIComponent(pathname.slice(prefix.length));
  const parts = relative.split("/");
  if (
    parts.length < 3 ||
    parts[0] !== "runs" ||
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes("\\"),
    )
  ) {
    sendError(
      response,
      400,
      "INVALID_ARTIFACT_PATH",
      "Invalid artifact path",
      headers,
    );
    return;
  }
  const runId = parts[1]!;
  const run = await db.run.findUnique({
    where: { id: runId },
    select: { artifactPath: true },
  });
  const expectedDirectory = path.join("runs", runId);
  if (
    !run?.artifactPath ||
    path.normalize(run.artifactPath) !== expectedDirectory
  ) {
    sendError(
      response,
      404,
      "ARTIFACT_NOT_FOUND",
      "Artifact not found",
      headers,
    );
    return;
  }
  const runRoot = path.resolve(config.artifactDir, expectedDirectory);
  const file = path.resolve(config.artifactDir, ...parts);
  if (!file.startsWith(`${runRoot}${path.sep}`)) {
    sendError(
      response,
      400,
      "INVALID_ARTIFACT_PATH",
      "Invalid artifact path",
      headers,
    );
    return;
  }
  try {
    const body = await readFile(file);
    const extension = path.extname(file).toLowerCase();
    response.writeHead(200, {
      ...headers,
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=60",
      ...(extension === ".zip"
        ? {
            "content-disposition": `attachment; filename="${path.basename(file)}"`,
          }
        : {}),
    });
    response.end(body);
  } catch {
    sendError(
      response,
      404,
      "ARTIFACT_NOT_FOUND",
      "Artifact not found",
      headers,
    );
  }
}

async function readiness(config: BackendConfig) {
  await db.$queryRaw`SELECT 1`;
  await db.runbook.count();
  await mkdir(config.artifactDir, { recursive: true });
  const probe = path.join(config.artifactDir, `.ready-${process.pid}`);
  await writeFile(probe, "ready", { flag: "wx" });
  await unlink(probe);
  new URL(config.demoBaseUrl);
  return {
    status: "ready",
    checks: {
      database: "ok",
      schema: "ok",
      artifactDirectory: "writable",
      workerConfiguration: "valid",
      environment: "valid",
    },
  };
}

export function createBackendServer(config = getBackendConfig()) {
  const server = createServer(async (request, response) => {
    const cors = corsHeaders(request, config);
    if (cors === null) {
      sendError(response, 403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed");
      return;
    }
    const headers = {
      ...cors,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...headers,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,x-flowproof-secret",
        "access-control-max-age": "600",
      });
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", config.publicBaseUrl);
    const method = request.method ?? "GET";
    if (
      method === "POST" &&
      !hasValidSharedSecret(request, config.sharedSecret)
    ) {
      sendError(
        response,
        401,
        "INVALID_SHARED_SECRET",
        "Valid shared secret required",
        headers,
      );
      return;
    }
    try {
      if (method === "GET" && url.pathname === "/health") {
        sendJson(
          response,
          200,
          { status: "ok", llm: getLlmConfiguration() },
          headers,
        );
        return;
      }
      if (method === "GET" && url.pathname === "/ready") {
        sendJson(response, 200, await readiness(config), headers);
        return;
      }
      if (method === "GET" && url.pathname === "/api/dashboard") {
        sendJson(response, 200, await dashboard(), headers);
        return;
      }
      if (method === "GET" && url.pathname === "/api/evaluation") {
        sendJson(response, 200, evaluationData, headers);
        return;
      }
      if (method === "GET" && url.pathname === "/api/fixtures") {
        const items = await db.regression.findMany({
          where: { key: { in: [...regressionKeys] } },
          orderBy: { key: "asc" },
        });
        sendJson(response, 200, items, headers);
        return;
      }
      if (method === "POST" && url.pathname === "/api/fixtures") {
        const input = regressionSchema.parse(await readJson(request));
        const item = await db.regression.upsert({
          where: { key: input.key },
          create: input,
          update: { enabled: input.enabled },
        });
        sendJson(response, 200, item, headers);
        return;
      }
      if (method === "POST" && url.pathname === "/api/fixtures/reset") {
        await resetDemo();
        sendJson(response, 200, { ok: true }, headers);
        return;
      }
      if (method === "POST" && url.pathname === "/api/demo") {
        await resetDemo();
        await db.regression.update({
          where: { key: "offboard.permission-drift" },
          data: { enabled: true },
        });
        const runbook = await db.runbook.findUnique({
          where: { slug: "offboard-contractor" },
        });
        if (!runbook) {
          sendError(
            response,
            404,
            "RUNBOOK_NOT_FOUND",
            "Seeded runbook not found",
            headers,
          );
          return;
        }
        const run = await queueRun(runbook.id);
        sendJson(response, 202, run, headers);
        return;
      }
      if (method === "POST" && url.pathname === "/api/runs") {
        const input = runSchema.parse(await readJson(request));
        const run = await queueRun(input.runbookId);
        if (!run) {
          sendError(
            response,
            404,
            "RUNBOOK_NOT_FOUND",
            "Runbook not found",
            headers,
          );
          return;
        }
        sendJson(response, 202, run, headers);
        return;
      }
      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (method === "GET" && runMatch) {
        const run = await db.run.findUnique({
          where: { id: runMatch[1] },
          include: { runbook: true },
        });
        if (!run) {
          sendError(response, 404, "RUN_NOT_FOUND", "Run not found", headers);
          return;
        }
        sendJson(response, 200, run, headers);
        return;
      }
      const recoveryMatch = url.pathname.match(
        /^\/api\/runs\/([^/]+)\/recover$/,
      );
      if (method === "POST" && recoveryMatch) {
        const previous = await db.run.findUnique({
          where: { id: recoveryMatch[1] },
        });
        if (!previous) {
          sendError(response, 404, "RUN_NOT_FOUND", "Run not found", headers);
          return;
        }
        await resetDemo();
        const run = await queueRun(previous.runbookId);
        sendJson(response, 202, run, headers);
        return;
      }
      const compareMatch = url.pathname.match(
        /^\/api\/runbooks\/([^/]+)\/compare$/,
      );
      if (method === "GET" && compareMatch) {
        const runbook = await db.runbook.findUnique({
          where: { id: compareMatch[1] },
          include: {
            runs: {
              where: { status: { in: ["PASS", "FAIL"] } },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        });
        if (!runbook) {
          sendError(
            response,
            404,
            "RUNBOOK_NOT_FOUND",
            "Runbook not found",
            headers,
          );
          return;
        }
        sendJson(response, 200, runbook, headers);
        return;
      }
      if (method === "POST" && url.pathname === "/api/runbooks") {
        const input = runbookInputSchema.parse(await readJson(request));
        const runbook = parseRunbook(input.yaml);
        const stored = await db.runbook.create({
          data: {
            slug: runbook.slug,
            name: runbook.name,
            description: runbook.description,
            severity: runbook.severity,
            yaml: input.yaml,
          },
        });
        sendJson(response, 201, { id: stored.id }, headers);
        return;
      }
      if (method === "POST" && url.pathname === "/api/compile") {
        const input = compileSchema.parse(await readJson(request));
        const runbook = await compileNaturalLanguage(input.prompt);
        sendJson(response, 200, { yaml: stringifyRunbook(runbook) }, headers);
        return;
      }
      if (method === "GET" && url.pathname === "/api/settings") {
        const [repository, token] = await Promise.all([
          db.setting.findUnique({ where: { key: "github.repository" } }),
          db.setting.findUnique({ where: { key: "github.token" } }),
        ]);
        sendJson(
          response,
          200,
          {
            repository:
              repository?.value ?? process.env.GITHUB_REPOSITORY ?? "",
            connected: Boolean(token?.value || process.env.GITHUB_TOKEN),
          },
          headers,
        );
        return;
      }
      if (method === "POST" && url.pathname === "/api/settings") {
        const input = settingSchema.parse(await readJson(request));
        if (input.repository !== undefined)
          await db.setting.upsert({
            where: { key: "github.repository" },
            create: { key: "github.repository", value: input.repository },
            update: { value: input.repository },
          });
        if (input.token)
          await db.setting.upsert({
            where: { key: "github.token" },
            create: { key: "github.token", value: input.token },
            update: { value: input.token },
          });
        sendJson(response, 200, { ok: true }, headers);
        return;
      }
      if (method === "GET" && url.pathname.startsWith("/api/artifacts/")) {
        await serveArtifact(url.pathname, response, headers, config);
        return;
      }
      sendError(response, 404, "NOT_FOUND", "Endpoint not found", headers);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        sendError(
          response,
          400,
          "VALIDATION_ERROR",
          "Invalid request",
          headers,
        );
        return;
      }
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
        sendError(
          response,
          413,
          "REQUEST_TOO_LARGE",
          "Request body is too large",
          headers,
        );
        return;
      }
      console.error("FlowProof backend request failed", {
        method,
        path: url.pathname,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      sendError(response, 500, "INTERNAL_ERROR", "Request failed", headers);
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 20_000;
  return server;
}
