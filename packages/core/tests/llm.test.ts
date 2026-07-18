import { describe, expect, it } from "vitest";
import {
  compileNaturalLanguage,
  diagnoseFailure,
  extractResponseText,
} from "../src";

describe("GPT-5.6 product functions", () => {
  it("extracts and validates text from the Responses REST payload", () => {
    expect(
      extractResponseText({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"rootCause":"drift"}' }],
          },
        ],
      }),
    ).toBe('{"rootCause":"drift"}');
    expect(() => extractResponseText({ output_text: "SDK only" })).toThrow();
  });

  it("compiles an SOP into a complete typed runbook in seeded mode", async () => {
    const runbook = await compileNaturalLanguage(
      "Offboard a contractor and prove all access is removed.",
    );
    expect(runbook).toMatchObject({
      severity: "critical",
      credentialsRef: "demo-local",
    });
    expect(runbook.preconditions.length).toBeGreaterThan(0);
    expect(runbook.steps.length).toBeGreaterThan(0);
    expect(runbook.postconditions.length).toBeGreaterThan(0);
    expect(runbook.invariants.length).toBeGreaterThan(0);
    expect(runbook.requiredEvidence).toContain("trace");
    expect(runbook.rollback?.humanApprovalRequired).toBe(true);
    expect(runbook.escalation?.instructions).toBeTruthy();
  });

  it("returns a typed evidence-grounded diagnosis without deciding verdict", async () => {
    const diagnosis = await diagnoseFailure({
      runbookName: "Offboard Contractor",
      severity: "critical",
      failedStep: null,
      violatedInvariant: {
        id: "membership-removed",
        name: "Repository membership removed",
        status: "FAIL",
        expected: false,
        actual: true,
        message: "Expected false, received true",
      },
      steps: [
        {
          id: "revoke",
          name: "Revoke repository access",
          status: "PASS",
          durationMs: 20,
          screenshot: "runs/1/revoke.png",
        },
      ],
      invariants: [],
      tracePath: "runs/1/trace.zip",
    });
    expect(diagnosis).toMatchObject({
      model: "gpt-5.6",
      providerMode: "seeded",
      violatedInvariant: "Repository membership removed",
      humanApprovalRequired: true,
    });
    expect(diagnosis.evidenceReferences).toEqual(
      expect.arrayContaining([
        "invariant:membership-removed",
        "runs/1/revoke.png",
        "runs/1/trace.zip",
      ]),
    );
  });
});
