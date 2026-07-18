import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";

await ensureSqliteFile();

for (const args of [["prisma", "migrate", "deploy"], ["seed:production"]]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const children: ChildProcess[] = [];
let stopping = false;

function start(name: string, args: string[]): ChildProcess {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
    detached: process.platform !== "win32",
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    console.error(
      `${name} exited unexpectedly (${signal ?? code ?? "unknown"})`,
    );
    stop(code ?? 1);
  });
  return child;
}

function stop(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.killed || !child.pid) continue;
    if (process.platform === "win32") child.kill("SIGTERM");
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // The child may already have exited between the checks.
      }
    }
  }
  setTimeout(() => process.exit(code), 8_000).unref();
  Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
    ),
  ).then(() => process.exit(code));
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

children.push(
  start("backend", ["--filter", "@flowproof/backend", "start"]),
  start("demo", ["--filter", "@flowproof/demo-suite", "start"]),
  start("worker", ["--filter", "@flowproof/worker", "start"]),
);

async function ensureSqliteFile(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:"))
    throw new Error("start:railway requires a SQLite DATABASE_URL");
  const configured = databaseUrl.slice("file:".length).split("?", 1)[0];
  if (!configured) throw new Error("DATABASE_URL must include a SQLite path");
  const file = path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), "prisma", configured);
  await mkdir(path.dirname(file), { recursive: true });
  await (await open(file, "a")).close();
}
