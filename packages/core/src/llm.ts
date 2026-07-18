import {
  diagnosisContentSchema,
  diagnosisSchema,
  runbookSchema,
  type Diagnosis,
  type DiagnosisContent,
  type InvariantResult,
  type Runbook,
  type StepResult,
} from "./schema";
import { getLlmConfiguration } from "./deployment";
import { z } from "zod";

export const FLOWPROOF_MODEL = "gpt-5.6" as const;

export type GenerateTextInput = { system: string; prompt: string };
export type GenerateObjectInput<T> = GenerateTextInput & {
  schema: { parse(value: unknown): T };
  outputSchema: Record<string, unknown>;
  task: "runbook-compilation" | "failure-diagnosis";
  mockValue: unknown;
};

export interface LanguageModel {
  readonly mode: "seeded" | "live";
  readonly model: typeof FLOWPROOF_MODEL;
  generateText(input: GenerateTextInput): Promise<string>;
  generateObject<T>(input: GenerateObjectInput<T>): Promise<T>;
}

const responsesApiSchema = z.object({
  status: z.string().optional(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.discriminatedUnion("type", [
            z.object({ type: z.literal("output_text"), text: z.string() }),
            z.object({ type: z.literal("refusal"), refusal: z.string() }),
          ]),
        )
        .optional(),
    }),
  ),
});

export function extractResponseText(value: unknown): string {
  const response = responsesApiSchema.parse(value);
  const parts = response.output.flatMap((item) => item.content ?? []);
  const refusal = parts.find((part) => part.type === "refusal");
  if (refusal?.type === "refusal")
    throw new Error("OpenAI refused the request");
  const text = parts
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error("OpenAI returned no text");
  return text;
}

export class OpenAIModel implements LanguageModel {
  readonly mode = "live" as const;
  readonly model = FLOWPROOF_MODEL;

  constructor(private apiKey = process.env.OPENAI_API_KEY) {
    const configured = getLlmConfiguration().model;
    if (configured !== FLOWPROOF_MODEL)
      throw new Error(`FlowProof requires OPENAI_MODEL=${FLOWPROOF_MODEL}`);
  }

  async generateText(input: GenerateTextInput): Promise<string> {
    return this.request(input);
  }

  private async request(
    input: GenerateTextInput,
    format?: Record<string, unknown>,
  ): Promise<string> {
    if (!this.apiKey)
      throw new Error("OPENAI_API_KEY is required when mock mode is disabled");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: `${input.system}\n\n${input.prompt}`,
        max_output_tokens: 4_000,
        reasoning: { effort: "none" },
        ...(format ? { text: { format } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok)
      throw new Error(`OpenAI request failed: ${response.status}`);
    return extractResponseText(await response.json());
  }

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    const text = await this.request(
      {
        system: input.system,
        prompt: input.prompt,
      },
      {
        type: "json_schema",
        name: input.task.replaceAll("-", "_"),
        strict: true,
        schema: input.outputSchema,
      },
    );
    try {
      return input.schema.parse(JSON.parse(text));
    } catch (error) {
      if (error instanceof z.ZodError)
        console.error("OpenAI schema validation failed", {
          task: input.task,
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        });
      throw new Error("OpenAI output failed schema validation");
    }
  }
}

export class MockModel implements LanguageModel {
  readonly mode = "seeded" as const;
  readonly model = FLOWPROOF_MODEL;

  async generateText(input: GenerateTextInput): Promise<string> {
    return /status fail/i.test(input.prompt)
      ? "Seeded diagnosis found a deterministic business invariant violation. Review cited screenshots and trace before repair."
      : "Verification completed. All browser steps and business invariants passed.";
  }

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    return input.schema.parse(input.mockValue);
  }
}

const invariantJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "endpoint", "path", "operator", "expected"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    endpoint: { type: "string", pattern: "^/" },
    path: { type: "string" },
    operator: {
      type: "string",
      enum: ["equals", "notEquals", "includes", "truthy"],
    },
    expected: { type: ["string", "number", "boolean", "null"] },
  },
} as const;

const baseStepProperties = {
  id: { type: "string" },
  name: { type: "string" },
  timeoutMs: { type: "integer", minimum: 1, maximum: 30_000 },
} as const;

const stepJsonSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "action", "path", "timeoutMs"],
      properties: {
        ...baseStepProperties,
        action: { type: "string", const: "goto" },
        path: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "action", "selector", "timeoutMs"],
      properties: {
        ...baseStepProperties,
        action: { type: "string", enum: ["click"] },
        selector: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "action", "selector", "value", "timeoutMs"],
      properties: {
        ...baseStepProperties,
        action: { type: "string", const: "fill" },
        selector: { type: "string" },
        value: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "action", "selector", "expected", "timeoutMs"],
      properties: {
        ...baseStepProperties,
        action: { type: "string", const: "assertText" },
        selector: { type: "string" },
        expected: { type: "string" },
      },
    },
  ],
} as const;

const guidanceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["instructions", "humanApprovalRequired"],
  properties: {
    instructions: { type: "string" },
    humanApprovalRequired: { type: "boolean" },
  },
} as const;

const runbookJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "name",
    "slug",
    "description",
    "targetApps",
    "credentialsRef",
    "severity",
    "preconditions",
    "steps",
    "postconditions",
    "invariants",
    "requiredEvidence",
    "rollback",
    "escalation",
  ],
  properties: {
    version: { type: "integer", const: 1 },
    name: { type: "string" },
    slug: { type: "string", pattern: "^[a-z0-9-]+$" },
    description: { type: "string" },
    targetApps: { type: "array", minItems: 1, items: { type: "string" } },
    credentialsRef: { type: "string" },
    severity: {
      type: "string",
      enum: ["low", "medium", "high", "critical"],
    },
    preconditions: { type: "array", items: invariantJsonSchema },
    steps: { type: "array", minItems: 1, items: stepJsonSchema },
    postconditions: { type: "array", items: { type: "string" } },
    invariants: {
      type: "array",
      minItems: 1,
      items: invariantJsonSchema,
    },
    requiredEvidence: {
      type: "array",
      minItems: 1,
      items: {
        type: "string",
        enum: ["screenshots", "trace", "invariant-results", "audit-record"],
      },
    },
    rollback: guidanceJsonSchema,
    escalation: guidanceJsonSchema,
  },
} as const;

const diagnosisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "rootCause",
    "failingStep",
    "violatedInvariant",
    "evidenceReferences",
    "businessImpact",
    "confidence",
    "recommendedProcedureChange",
    "humanApprovalRequired",
  ],
  properties: {
    rootCause: { type: "string" },
    failingStep: { type: ["string", "null"] },
    violatedInvariant: { type: ["string", "null"] },
    evidenceReferences: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    },
    businessImpact: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    recommendedProcedureChange: { type: "string" },
    humanApprovalRequired: { type: "boolean" },
  },
} as const;

export function getLanguageModel(): LanguageModel {
  return getLlmConfiguration().mode === "live"
    ? new OpenAIModel()
    : new MockModel();
}

function compiledMock(prompt: string): Runbook {
  const lower = prompt.toLowerCase();
  const refund = lower.includes("refund");
  return {
    version: 1,
    name: refund ? "Refund Customer SOP" : "Offboard Contractor SOP",
    slug: refund ? "compiled-refund-customer" : "compiled-offboard-contractor",
    description:
      prompt.trim().slice(0, 240) ||
      "Verify a critical browser workflow and its business outcomes.",
    targetApps: refund
      ? ["billing", "internal-crm"]
      : ["identity-admin", "mock-repository"],
    credentialsRef: "demo-local",
    severity: refund ? "high" : "critical",
    preconditions: refund
      ? [
          {
            id: "order-paid",
            name: "Order starts paid",
            endpoint: "/api/demo/billing",
            path: "order.status",
            operator: "equals",
            expected: "paid",
          },
        ]
      : [
          {
            id: "identity-active",
            name: "Contractor starts active",
            endpoint: "/api/demo/identity",
            path: "user.disabled",
            operator: "equals",
            expected: false,
          },
        ],
    steps: [
      {
        id: "open",
        name: "Open target application",
        action: "goto",
        path: refund ? "/billing" : "/identity",
        timeoutMs: 5_000,
      },
    ],
    postconditions: refund
      ? [
          "Order is refunded",
          "Customer confirmation is sent",
          "Internal audit note exists",
        ]
      : [
          "Identity is disabled",
          "Active access is denied",
          "Repository membership is removed",
        ],
    invariants: refund
      ? [
          {
            id: "refunded",
            name: "Order is refunded",
            endpoint: "/api/demo/billing",
            path: "order.status",
            operator: "equals",
            expected: "refunded",
          },
        ]
      : [
          {
            id: "membership-removed",
            name: "Repository membership removed",
            endpoint: "/api/demo/identity",
            path: "githubMember",
            operator: "equals",
            expected: false,
          },
        ],
    requiredEvidence: [
      "screenshots",
      "trace",
      "invariant-results",
      "audit-record",
    ],
    rollback: {
      instructions: refund
        ? "Escalate refund reversal to Finance before changing payment state."
        : "Re-enable identity only after manager and Security approval.",
      humanApprovalRequired: true,
    },
    escalation: {
      instructions:
        "Open a high-severity operations issue with the captured evidence packet.",
      humanApprovalRequired: true,
    },
  };
}

export async function compileNaturalLanguage(prompt: string): Promise<Runbook> {
  return getLanguageModel().generateObject({
    task: "runbook-compilation",
    schema: runbookSchema,
    outputSchema: runbookJsonSchema,
    mockValue: compiledMock(prompt),
    system: `Compile an operations SOP into a typed FlowProof runbook. Include ordered browser steps, deterministic API-backed preconditions and business invariants, human-readable postconditions, required evidence, severity, and rollback or escalation guidance. Actions: goto, click, fill, assertText. Model: ${FLOWPROOF_MODEL}.`,
    prompt,
  });
}

export type FailureDiagnosisInput = {
  runbookName: string;
  severity: string;
  failedStep: StepResult | null;
  violatedInvariant: InvariantResult | null;
  steps: StepResult[];
  invariants: InvariantResult[];
  tracePath: string;
};

function seededDiagnosis(input: FailureDiagnosisInput): DiagnosisContent {
  const invariant = input.violatedInvariant;
  const roots: Record<
    string,
    { cause: string; impact: string; change: string }
  > = {
    "membership-removed": {
      cause:
        "Repository access revocation completed visually, but membership remained active in the authoritative state.",
      impact:
        "Offboarded contractor retains source-code access after identity disablement.",
      change:
        "Require membership removal verification and Security approval before closing offboarding.",
    },
    "note-created": {
      cause:
        "Refund actions completed, but the required internal audit note was not persisted.",
      impact:
        "Finance and Support lose the audit trail needed to explain the refund.",
      change:
        "Treat note persistence as a blocking postcondition and retry before completion.",
    },
    "forbidden-state": {
      cause:
        "Role-binding change did not make the protected page inaccessible.",
      impact: "Target user retains access to sensitive production data.",
      change:
        "Verify effective authorization state after every policy change and escalate permission drift.",
    },
    "order-paid": {
      cause:
        "Workflow started from an unexpected order state instead of the required paid baseline.",
      impact: "Continuing could duplicate a refund or corrupt the audit trail.",
      change:
        "Stop before browser mutations when the order is not paid and request human review.",
    },
    "sequence-valid": {
      cause:
        "Customer confirmation was attempted before the refund transaction completed.",
      impact:
        "Customer communication can claim a refund that has not yet occurred.",
      change:
        "Lock runbook ordering so refund completion precedes notification.",
    },
  };
  const selected = roots[invariant?.id ?? ""] ?? {
    cause: input.failedStep
      ? `Browser execution stopped at ${input.failedStep.name}.`
      : "A deterministic business postcondition was not satisfied.",
    impact: "Critical operational workflow cannot be proven complete.",
    change: "Review the failed step and invariant evidence before rerunning.",
  };
  const screenshot =
    input.failedStep?.screenshot ||
    [...input.steps].reverse().find((step) => step.screenshot)?.screenshot;
  return {
    rootCause: selected.cause,
    failingStep: input.failedStep?.name ?? null,
    violatedInvariant: invariant?.name ?? null,
    evidenceReferences: [
      invariant ? `invariant:${invariant.id}` : null,
      screenshot,
      input.tracePath,
    ].filter((value): value is string => Boolean(value)),
    businessImpact: selected.impact,
    confidence: 0.98,
    recommendedProcedureChange: selected.change,
    humanApprovalRequired: input.severity === "critical",
  };
}

export async function diagnoseFailure(
  input: FailureDiagnosisInput,
): Promise<Diagnosis> {
  const model = getLanguageModel();
  const content = await model.generateObject({
    task: "failure-diagnosis",
    schema: diagnosisContentSchema,
    outputSchema: diagnosisJsonSchema,
    mockValue: seededDiagnosis(input),
    system: `Diagnose a failed operational workflow from structured evidence. Never decide PASS or FAIL; deterministic invariant results are authoritative. Cite only supplied evidence. Return rootCause, failingStep, violatedInvariant, evidenceReferences, businessImpact, confidence from 0 to 1, recommendedProcedureChange, and humanApprovalRequired. Model: ${FLOWPROOF_MODEL}.`,
    prompt: JSON.stringify(input),
  });
  return diagnosisSchema.parse({
    ...content,
    providerMode: model.mode,
    model: model.model,
  });
}
