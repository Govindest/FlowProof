import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "file:./dev.db";
if (!process.env.DATABASE_URL.startsWith("file:"))
  throw new Error("FlowProof requires a SQLite DATABASE_URL");
const configured = process.env.DATABASE_URL.slice("file:".length).split(
  "?",
  1,
)[0]!;
const databaseFile = path.isAbsolute(configured)
  ? configured
  : path.resolve(process.cwd(), "prisma", configured);
mkdirSync(path.dirname(databaseFile), { recursive: true });
closeSync(openSync(databaseFile, "a"));

const command = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(
  command,
  [...process.argv.slice(2), "--schema", "prisma/schema.prisma"],
  { stdio: "inherit", shell: false },
);
process.exit(result.status ?? 1);
