import { spawnSync } from "node:child_process";

if (process.env.VERCEL) {
  console.log("Vercel web install: skipping Prisma and Chromium setup.");
  process.exit(0);
}

const prisma = spawnSync(
  "pnpm",
  ["exec", "prisma", "generate", "--schema", "prisma/schema.prisma"],
  { stdio: "inherit", shell: false },
);
if (prisma.status !== 0) process.exit(prisma.status ?? 1);

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
  console.log("Using Chromium supplied by the container image.");
  process.exit(0);
}

const browser = spawnSync(
  "pnpm",
  ["exec", "playwright", "install", "chromium"],
  {
    stdio: "inherit",
    shell: false,
  },
);
process.exit(browser.status ?? 1);
