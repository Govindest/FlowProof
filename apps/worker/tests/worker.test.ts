import { describe, expect, it } from "vitest";
import { publicWorkerFailure } from "../src/worker";

describe("publicWorkerFailure", () => {
  it("does not expose internal browser paths", () => {
    const message = publicWorkerFailure(
      new Error(
        "browserType.launch: Executable doesn't exist at /ms-playwright/chromium/chrome",
      ),
    );

    expect(message).toBe(
      "Browser worker could not start Chromium. Review worker configuration and deployment logs.",
    );
    expect(message).not.toContain("/ms-playwright");
  });

  it("does not expose unexpected error details", () => {
    const message = publicWorkerFailure(
      new Error("request failed with token secret-value at /data/private.db"),
    );

    expect(message).toBe(
      "Workflow execution failed before an evidence packet could be completed. Review worker logs.",
    );
    expect(message).not.toContain("secret-value");
    expect(message).not.toContain("/data/private.db");
  });
});
