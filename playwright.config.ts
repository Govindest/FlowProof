import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      FLOWPROOF_LLM_MODE: "seeded",
      FLOWPROOF_MOCK: "true",
    },
  },
});
