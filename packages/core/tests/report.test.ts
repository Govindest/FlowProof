import { describe, expect, it } from "vitest";
import { buildEvidenceMarkdown, buildIssueDraft } from "../src";

const failed = {
  id: "run_1",
  status: "FAIL" as const,
  runbook: {
    id: "book_1",
    slug: "refund",
    name: "Refund Customer",
    severity: "high",
  },
  durationMs: 1234,
  tracePath: "runs/run_1/trace.zip",
  explanation: "Internal note was not persisted.",
  preconditions: [],
  diagnosis: null,
  steps: [
    {
      id: "note",
      name: "Create note",
      status: "PASS" as const,
      durationMs: 20,
      screenshot: "runs/run_1/note.png",
    },
  ],
  invariants: [
    {
      id: "note",
      name: "Note exists",
      status: "FAIL" as const,
      expected: true,
      actual: "",
      message: "Expected true, received empty string",
    },
  ],
};

describe("report generation", () => {
  it("builds markdown evidence with trace", () =>
    expect(buildEvidenceMarkdown(failed)).toContain("runs/run_1/trace.zip"));
  it("builds actionable issue draft only for failure", () =>
    expect(buildIssueDraft(failed)).toMatchObject({
      title: "[FlowProof] Refund Customer verification failed",
      labels: ["flowproof", "severity:high"],
    }));
});
