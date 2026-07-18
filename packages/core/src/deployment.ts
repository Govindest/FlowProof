import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const backendEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3_200),
  FLOWPROOF_PUBLIC_BASE_URL: z.string().url().default("http://127.0.0.1:3200"),
  FLOWPROOF_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000"),
  FLOWPROOF_BACKEND_SHARED_SECRET: z.string().min(16).optional(),
  FLOWPROOF_ARTIFACT_DIR: z.string().min(1).optional(),
  DEMO_BASE_URL: z.string().url().default("http://127.0.0.1:3100"),
});

export type BackendConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  publicBaseUrl: string;
  allowedOrigins: string[];
  sharedSecret: string;
  artifactDir: string;
  demoBaseUrl: string;
};

export function findWorkspaceRoot(start = process.cwd()): string {
  let current = path.resolve(start);
  while (
    !existsSync(path.join(current, "pnpm-workspace.yaml")) &&
    path.dirname(current) !== current
  )
    current = path.dirname(current);
  return current;
}

export function getArtifactRoot(env = process.env): string {
  const configured = env.FLOWPROOF_ARTIFACT_DIR;
  if (!configured) return path.join(findWorkspaceRoot(), "artifacts");
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(findWorkspaceRoot(), configured);
}

export function getBackendConfig(env = process.env): BackendConfig {
  const value = backendEnvironmentSchema.parse(env);
  const allowedOrigins = value.FLOWPROOF_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
  const sharedSecret =
    value.FLOWPROOF_BACKEND_SHARED_SECRET ?? "flowproof-local-demo-secret";
  if (value.NODE_ENV === "production") {
    if (!value.FLOWPROOF_BACKEND_SHARED_SECRET)
      throw new Error(
        "FLOWPROOF_BACKEND_SHARED_SECRET is required in production",
      );
    if (!env.FLOWPROOF_PUBLIC_BASE_URL)
      throw new Error("FLOWPROOF_PUBLIC_BASE_URL is required in production");
    if (!env.FLOWPROOF_ALLOWED_ORIGINS)
      throw new Error("FLOWPROOF_ALLOWED_ORIGINS is required in production");
    if (!env.DATABASE_URL)
      throw new Error("DATABASE_URL is required in production");
    if (!env.FLOWPROOF_ARTIFACT_DIR)
      throw new Error("FLOWPROOF_ARTIFACT_DIR is required in production");
  }
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    publicBaseUrl: value.FLOWPROOF_PUBLIC_BASE_URL.replace(/\/$/, ""),
    allowedOrigins,
    sharedSecret,
    artifactDir: getArtifactRoot(env),
    demoBaseUrl: value.DEMO_BASE_URL.replace(/\/$/, ""),
  };
}

export function getLlmConfiguration(env = process.env): {
  mode: "seeded" | "live";
  model: "gpt-5.6";
} {
  const requestedMode =
    env.FLOWPROOF_LLM_MODE ??
    (env.FLOWPROOF_MOCK === "false" ? "live" : "seeded");
  const mode = z.enum(["seeded", "live"]).parse(requestedMode);
  const model = z
    .literal("gpt-5.6")
    .parse(env.FLOWPROOF_LLM_MODEL ?? env.OPENAI_MODEL ?? "gpt-5.6");
  return { mode, model };
}
