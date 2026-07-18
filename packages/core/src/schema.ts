import { z } from "zod";

export const stepSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    action: z.enum(["goto", "click", "fill", "assertText"]),
    path: z.string().optional(),
    selector: z.string().optional(),
    value: z.string().optional(),
    expected: z.string().optional(),
    timeoutMs: z.number().int().positive().max(30_000).default(5_000),
  })
  .superRefine((step, context) => {
    if (step.action === "goto" && !step.path)
      context.addIssue({ code: "custom", message: "goto requires path" });
    if (["click", "fill", "assertText"].includes(step.action) && !step.selector)
      context.addIssue({
        code: "custom",
        message: `${step.action} requires selector`,
      });
    if (step.action === "fill" && step.value === undefined)
      context.addIssue({ code: "custom", message: "fill requires value" });
    if (step.action === "assertText" && step.expected === undefined)
      context.addIssue({
        code: "custom",
        message: "assertText requires expected",
      });
  });

export const invariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  endpoint: z.string().startsWith("/"),
  path: z.string().min(1),
  operator: z.enum(["equals", "notEquals", "includes", "truthy"]),
  expected: z.unknown().optional(),
});

export const guidanceSchema = z.object({
  instructions: z.string().min(3),
  humanApprovalRequired: z.boolean(),
});

export const runbookSchema = z.object({
  version: z.literal(1),
  name: z.string().min(3),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(10),
  targetApps: z.array(z.string().min(1)).min(1),
  credentialsRef: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  preconditions: z.array(invariantSchema).default([]),
  steps: z.array(stepSchema).min(1),
  postconditions: z.array(z.string().min(1)).default([]),
  invariants: z.array(invariantSchema).min(1),
  requiredEvidence: z
    .array(
      z.enum(["screenshots", "trace", "invariant-results", "audit-record"]),
    )
    .min(1)
    .default(["screenshots", "trace", "invariant-results"]),
  rollback: guidanceSchema.optional(),
  escalation: guidanceSchema.optional(),
});

export const diagnosisContentSchema = z.object({
  rootCause: z.string().min(5),
  failingStep: z.string().nullable(),
  violatedInvariant: z.string().nullable(),
  evidenceReferences: z.array(z.string().min(1)).min(1),
  businessImpact: z.string().min(5),
  confidence: z.number().min(0).max(1),
  recommendedProcedureChange: z.string().min(5),
  humanApprovalRequired: z.boolean(),
});

export const diagnosisSchema = diagnosisContentSchema.extend({
  providerMode: z.enum(["seeded", "live"]),
  model: z.literal("gpt-5.6"),
});

export type Runbook = z.infer<typeof runbookSchema>;
export type RunbookStep = z.infer<typeof stepSchema>;
export type Invariant = z.infer<typeof invariantSchema>;
export type DiagnosisContent = z.infer<typeof diagnosisContentSchema>;
export type Diagnosis = z.infer<typeof diagnosisSchema>;

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

export type RunResult = {
  id: string;
  runbook: { id: string; slug: string; name: string; severity: string };
  status: "PASS" | "FAIL";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: StepResult[];
  preconditions: InvariantResult[];
  invariants: InvariantResult[];
  tracePath: string;
  explanation: string;
  diagnosis: Diagnosis | null;
  issueDraft: IssueDraft | null;
};

export type IssueDraft = {
  title: string;
  body: string;
  labels: string[];
  attachments: string[];
};
