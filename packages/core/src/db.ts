import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { findWorkspaceRoot } from "./deployment";

process.env.DATABASE_URL ??= `file:${path.join(findWorkspaceRoot(), "prisma", "dev.db")}`;

const globalDb = globalThis as unknown as { flowproofDb?: PrismaClient };
export const db = globalDb.flowproofDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.flowproofDb = db;

export async function getDemoState<T>(key: string, fallback: T): Promise<T> {
  const record = await db.demoState.findUnique({ where: { key } });
  return record ? (JSON.parse(record.value) as T) : fallback;
}

export async function setDemoState(key: string, value: unknown): Promise<void> {
  await db.demoState.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}
