import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/backend/tests/**/*.test.ts",
      "apps/web/tests/**/*.test.ts",
      "apps/worker/tests/**/*.test.ts",
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: {
      FLOWPROOF_LLM_MODE: "seeded",
      FLOWPROOF_MOCK: "true",
    },
  },
});
