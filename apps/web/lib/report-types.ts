export type StepResult = {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  durationMs: number;
  screenshot: string;
  error?: string;
};

export type InvariantResult = {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  expected: unknown;
  actual: unknown;
  message: string;
};

export type IssueDraft = {
  title: string;
  body: string;
  labels: string[];
  attachments: string[];
};

export type RunResult = {
  preconditions: InvariantResult[];
  diagnosis: {
    providerMode: "seeded" | "live";
    model: "gpt-5.6";
    rootCause: string;
    failingStep: string | null;
    violatedInvariant: string | null;
    evidenceReferences: string[];
    businessImpact: string;
    confidence: number;
    recommendedProcedureChange: string;
    humanApprovalRequired: boolean;
  } | null;
};
