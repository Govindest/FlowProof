import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BackendApiError,
  backendFetch,
  type RunDetail,
} from "../../../lib/backend";
import type {
  InvariantResult,
  IssueDraft,
  RunResult,
  StepResult,
} from "../../../lib/report-types";
import {
  formatDuration,
  formatTime,
  Status,
  VerifyButton,
} from "../../../components/ui";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let run: RunDetail;
  try {
    run = await backendFetch<RunDetail>(`/api/runs/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) notFound();
    return (
      <main>
        <section className="empty backend-unavailable" role="alert">
          <h1>Run report unavailable</h1>
          <p>The execution backend could not be reached. Refresh to retry.</p>
        </section>
      </main>
    );
  }

  const pending = run.status === "QUEUED" || run.status === "RUNNING";
  const result = run.resultJson
    ? (JSON.parse(run.resultJson) as RunResult)
    : null;
  const steps = JSON.parse(run.stepsJson) as StepResult[];
  const preconditions = result?.preconditions ?? [];
  const invariants = JSON.parse(run.invariantsJson) as InvariantResult[];
  const issue = run.issueDraftJson
    ? (JSON.parse(run.issueDraftJson) as IssueDraft)
    : null;
  const failedChecks = [...preconditions, ...invariants].filter(
    (item) => item.status === "FAIL",
  );
  const diagnosis = result?.diagnosis ?? null;

  return (
    <main>
      {pending && <meta httpEquiv="refresh" content="2" />}
      <div className="crumbs">
        <Link href="/">Workflows</Link>
        <span>›</span>
        <span>{run.runbook.name}</span>
        <span>›</span>
        <span>Run {run.id.slice(-7)}</span>
      </div>
      <div className="run-head">
        <div>
          <div className="run-title">
            <h1>{run.runbook.name}</h1>
            <Status value={run.status} />
          </div>
          <p>
            Run <span className="mono">{run.id}</span> ·{" "}
            {formatTime(run.createdAt)}
          </p>
        </div>
        <div className="head-actions">
          <Link
            className="button secondary"
            href={`/runbooks/${run.runbookId}/compare`}
          >
            Compare runs
          </Link>
          {run.status === "FAIL" ? (
            <form action="/api/recover" method="post">
              <input type="hidden" name="runId" value={run.id} />
              <button className="button" type="submit">
                ↻ Repair & rerun
              </button>
            </form>
          ) : (
            <VerifyButton runbookId={run.runbookId} />
          )}
        </div>
      </div>

      {pending ? (
        <section className="running-card" aria-live="polite">
          <div className="scanner" />
          <Status value={run.status} />
          <h2>
            {run.status === "QUEUED"
              ? "Waiting for browser worker"
              : "Replaying workflow"}
          </h2>
          <p>
            Capturing step screenshots, timings, state checks, and Playwright
            trace.
          </p>
        </section>
      ) : (
        <>
          <section
            className={`result-banner result-${run.status.toLowerCase()}`}
          >
            <div className="result-symbol">
              {run.status === "PASS" ? "✓" : "!"}
            </div>
            <div>
              <p className="eyebrow">VERIFICATION {run.status}</p>
              <h2>
                {run.status === "PASS"
                  ? "Workflow proven end to end"
                  : "Workflow evidence captured"}
              </h2>
              <p>{run.explanation}</p>
            </div>
            <div className="result-meta">
              <span>
                Total time<strong>{formatDuration(run.durationMs)}</strong>
              </span>
              <span>
                Steps
                <strong>
                  {steps.filter((step) => step.status === "PASS").length}/
                  {steps.length}
                </strong>
              </span>
              <span>
                Checks
                <strong>
                  {
                    [...preconditions, ...invariants].filter(
                      (item) => item.status === "PASS",
                    ).length
                  }
                  /{preconditions.length + invariants.length}
                </strong>
              </span>
            </div>
          </section>

          {failedChecks.length > 0 && (
            <section className="panel failure-panel">
              <div className="panel-head">
                <div>
                  <h2>Violated business checks</h2>
                  <p>
                    Deterministic outcomes that did not match the typed runbook.
                  </p>
                </div>
                <span className="severity severity-critical">
                  {failedChecks.length} failed
                </span>
              </div>
              {failedChecks.map((item) => (
                <div className="invariant-row" key={item.id}>
                  <span className="failure-x">×</span>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.message}</p>
                  </div>
                  <code>{JSON.stringify(item.actual)}</code>
                </div>
              ))}
            </section>
          )}

          {diagnosis && (
            <section className="panel diagnosis-panel" data-testid="diagnosis">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">
                    {diagnosis.providerMode === "live" ? "LIVE" : "SEEDED"}{" "}
                    GPT-5.6 DIAGNOSIS
                  </p>
                  <h2>Evidence-grounded interpretation</h2>
                  <p>
                    GPT interprets captured proof; deterministic checks remain
                    verdict authority.
                  </p>
                </div>
                <span className={`model-badge model-${diagnosis.providerMode}`}>
                  {diagnosis.providerMode === "live"
                    ? "Live GPT-5.6"
                    : "Seeded demo output"}
                </span>
              </div>
              <div className="diagnosis-grid">
                <div className="diagnosis-primary">
                  <span>Root cause</span>
                  <strong>{diagnosis.rootCause}</strong>
                  <span>Business impact</span>
                  <p>{diagnosis.businessImpact}</p>
                  <span>Recommended procedure change</span>
                  <p>{diagnosis.recommendedProcedureChange}</p>
                </div>
                <dl>
                  <div>
                    <dt>Failing step</dt>
                    <dd>{diagnosis.failingStep ?? "Business postcondition"}</dd>
                  </div>
                  <div>
                    <dt>Violated invariant</dt>
                    <dd>
                      {diagnosis.violatedInvariant ??
                        "See deterministic checks"}
                    </dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{Math.round(diagnosis.confidence * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Human approval</dt>
                    <dd>
                      {diagnosis.humanApprovalRequired
                        ? "Required"
                        : "Not required"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="diagnosis-evidence">
                <strong>Evidence referenced</strong>
                {diagnosis.evidenceReferences.map((reference) =>
                  reference.startsWith("runs/") ? (
                    <a key={reference} href={`/api/artifacts/${reference}`}>
                      {reference.split("/").at(-1)}
                    </a>
                  ) : (
                    <code key={reference}>{reference}</code>
                  ),
                )}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Browser steps</h2>
                <p>
                  Screenshot evidence captured after every attempted action.
                </p>
              </div>
              {run.tracePath && (
                <a
                  data-testid="trace-download"
                  className="button secondary small"
                  href={`/api/artifacts/${run.tracePath}`}
                >
                  ↓ Download trace
                </a>
              )}
            </div>
            <div className="steps">
              {steps.map((step, index) => (
                <article className="step" key={`${step.id}-${index}`}>
                  <div
                    className={`step-index step-${step.status.toLowerCase()}`}
                  >
                    {step.status === "PASS"
                      ? "✓"
                      : step.status === "FAIL"
                        ? "×"
                        : index + 1}
                  </div>
                  <div className="step-content">
                    <div>
                      <span>STEP {index + 1}</span>
                      <h3>{step.name}</h3>
                      {step.error && <p className="error">{step.error}</p>}
                    </div>
                    <time>{formatDuration(step.durationMs)}</time>
                    {step.screenshot ? (
                      <a
                        data-testid="step-screenshot"
                        className="shot"
                        href={`/api/artifacts/${step.screenshot}`}
                        target="_blank"
                      >
                        <img
                          src={`/api/artifacts/${step.screenshot}`}
                          alt={`Screenshot after ${step.name}`}
                        />
                        <span>Open full screenshot</span>
                      </a>
                    ) : (
                      <div className="shot skipped-shot">Not executed</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="report-grid">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>Evidence packet</h2>
                  <p>Portable, judge-friendly run summary.</p>
                </div>
              </div>
              <pre className="evidence">{run.evidenceMarkdown}</pre>
              {run.artifactPath && (
                <div className="artifact-links">
                  <a href={`/api/artifacts/${run.artifactPath}/result.json`}>
                    Result JSON
                  </a>
                  <a href={`/api/artifacts/${run.artifactPath}/evidence.md`}>
                    Evidence Markdown
                  </a>
                  <a
                    href={`/api/artifacts/${run.artifactPath}/issue-draft.json`}
                  >
                    Issue draft JSON
                  </a>
                </div>
              )}
            </div>
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>GitHub issue draft</h2>
                  <p>
                    {issue
                      ? "Ready to review or publish."
                      : "Only generated for failed runs."}
                  </p>
                </div>
              </div>
              {issue ? (
                <>
                  <h3>{issue.title}</h3>
                  <pre className="issue-body">{issue.body}</pre>
                  <div className="labels">
                    {issue.labels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="proof-ok">
                  <span>✓</span>
                  <strong>No issue needed</strong>
                  <p>All expected outcomes were observed.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
