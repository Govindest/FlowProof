import { describe, expect, it } from "vitest";
import { parseRunbook } from "../src";

const valid = `version: 1
name: Verify access
slug: verify-access
description: Verify protected access is blocked.
targetApps: [identity]
credentialsRef: local
severity: high
steps:
  - id: open
    name: Open identity
    action: goto
    path: /identity
invariants:
  - id: blocked
    name: User is blocked
    endpoint: /api/state
    path: user.blocked
    operator: equals
    expected: true`;

describe("runbook YAML", () => {
  it("parses and applies step timeout defaults", () => {
    expect(parseRunbook(valid).steps[0]?.timeoutMs).toBe(5_000);
  });

  it("rejects actions missing required selector", () => {
    expect(() =>
      parseRunbook(
        valid.replace("action: goto\n    path: /identity", "action: click"),
      ),
    ).toThrow(/selector/);
  });

  it("rejects unknown severity", () => {
    expect(() =>
      parseRunbook(valid.replace("severity: high", "severity: catastrophic")),
    ).toThrow();
  });
});
