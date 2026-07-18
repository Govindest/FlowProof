import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(
  command,
  [...process.argv.slice(2), "--schema", "prisma/schema.prisma"],
  { stdio: "inherit", shell: false },
);
process.exit(result.status ?? 1);
