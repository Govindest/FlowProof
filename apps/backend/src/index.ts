import { db, getBackendConfig } from "@flowproof/core";
import { createBackendServer } from "./server";

const config = getBackendConfig();
await mkdirArtifacts();
const server = createBackendServer(config);
server.listen(config.port, "0.0.0.0", () => {
  console.log(`FlowProof backend ready on port ${config.port}`);
});

async function mkdirArtifacts() {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(config.artifactDir, { recursive: true });
}

async function shutdown(signal: string) {
  console.log(`FlowProof backend received ${signal}`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
