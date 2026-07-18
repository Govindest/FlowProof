export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type ApiRun = {
  id: string;
  runbookId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  stepsJson: string;
  invariantsJson: string;
  resultJson: string | null;
  explanation: string | null;
  evidenceMarkdown: string | null;
  issueDraftJson: string | null;
  artifactPath: string | null;
  tracePath: string | null;
  createdAt: string;
};

export type ApiRunbook = {
  id: string;
  slug: string;
  name: string;
  description: string;
  yaml: string;
  severity: string;
  createdAt: string;
};

export type EvaluationSummary = {
  generatedAt: string | null;
  providerMode: string;
  summary: {
    totalCases: number;
    expectationsMet: number;
    faultsDetected: number;
    correctInvariantIdentifications: number;
    evidencePacketsComplete: number;
    diagnosesReferencingEvidence: number;
    averageDurationMs: number;
  };
};

export type DashboardData = {
  runbooks: Array<ApiRunbook & { runs: ApiRun[] }>;
  recent: Array<ApiRun & { runbook: ApiRunbook }>;
  evaluation: EvaluationSummary;
  backend: {
    status: "available";
    llm: { mode: "seeded" | "live"; model: "gpt-5.6" };
  };
};

export type RunDetail = ApiRun & { runbook: ApiRunbook };
export type CompareDetail = ApiRunbook & { runs: ApiRun[] };

export function getBackendBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env.NEXT_PUBLIC_FLOWPROOF_API_URL ?? "http://127.0.0.1:3200";
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("FlowProof API URL must use HTTP or HTTPS");
  return url.toString().replace(/\/$/, "");
}

export async function backendFetch<T>(
  pathname: string,
  init: RequestInit = {},
  options: { authenticated?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (options.authenticated) {
    const secret = process.env.FLOWPROOF_BACKEND_SHARED_SECRET;
    if (!secret)
      throw new BackendApiError("Backend shared secret is not configured", 503);
    headers.set("x-flowproof-secret", secret);
  }
  const response = await fetch(new URL(pathname, `${getBackendBaseUrl()}/`), {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string } | string;
    } | null;
    const message =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ??
          `Backend request failed (${response.status})`);
    throw new BackendApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export async function backendStatus(): Promise<{
  connected: boolean;
  llmMode: "seeded" | "live" | null;
}> {
  try {
    const health = await backendFetch<{
      status: string;
      llm: { mode: "seeded" | "live" };
    }>("/health", {}, { timeoutMs: 2_000 });
    return { connected: true, llmMode: health.llm.mode };
  } catch {
    return { connected: false, llmMode: null };
  }
}
