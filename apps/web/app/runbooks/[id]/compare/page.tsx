import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BackendApiError,
  backendFetch,
  type ApiRun,
  type CompareDetail,
} from "../../../../lib/backend";
import type { InvariantResult, StepResult } from "../../../../lib/report-types";
import { formatDuration, formatTime, Status } from "../../../../components/ui";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let runbook: CompareDetail;
  try {
    runbook = await backendFetch<CompareDetail>(
      `/api/runbooks/${encodeURIComponent(id)}/compare`,
    );
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) notFound();
    return (
      <main>
        <section className="empty backend-unavailable" role="alert">
          <h1>Comparison unavailable</h1>
          <p>The execution backend could not be reached. Refresh to retry.</p>
        </section>
      </main>
    );
  }
  const current = runbook.runs[0];
  const previous = runbook.runs.find(
    (run, index) => index > 0 && run.status === "PASS",
  );
  const rows = current
    ? (JSON.parse(current.invariantsJson) as InvariantResult[])
    : [];
  const priorRows = previous
    ? (JSON.parse(previous.invariantsJson) as InvariantResult[])
    : [];
  const currentSteps = current
    ? (JSON.parse(current.stepsJson) as StepResult[])
    : [];
  const priorSteps = previous
    ? (JSON.parse(previous.stepsJson) as StepResult[])
    : [];
  return (
    <main>
      <div className="crumbs">
        <Link href="/">Workflows</Link>
        <span>›</span>
        <span>{runbook.name}</span>
        <span>›</span>
        <span>Compare</span>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">RUN COMPARISON</p>
          <h1>What changed?</h1>
          <p>Last successful proof beside current verification.</p>
        </div>
      </div>
      {!current ? (
        <section className="empty">
          <h2>No completed runs</h2>
          <p>Verify this runbook to establish baseline.</p>
        </section>
      ) : (
        <>
          <section className="compare-head">
            <RunSummary label="Last successful" run={previous} />
            <div className="compare-vs">VS</div>
            <RunSummary label="Current" run={current} />
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Invariant comparison</h2>
                <p>Business state before and after.</p>
              </div>
            </div>
            <div className="compare-table">
              <div className="compare-row compare-labels">
                <span>Invariant</span>
                <span>Last success</span>
                <span>Current</span>
              </div>
              {rows.map((row) => {
                const old = priorRows.find((item) => item.id === row.id);
                return (
                  <div className="compare-row" key={row.id}>
                    <strong>{row.name}</strong>
                    <span>
                      {old ? <Status value={old.status} /> : "—"}
                      <code>
                        {old ? JSON.stringify(old.actual) : "No baseline"}
                      </code>
                    </span>
                    <span>
                      <Status value={row.status} />
                      <code>{JSON.stringify(row.actual)}</code>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Timing delta</h2>
                <p>Per-step runtime against successful baseline.</p>
              </div>
            </div>
            {currentSteps.map((step) => {
              const before = priorSteps.find(
                (item) => item.id === step.id,
              )?.durationMs;
              const delta = before == null ? null : step.durationMs - before;
              return (
                <div className="timing-row" key={step.id}>
                  <span>{step.name}</span>
                  <span className="mono">{formatDuration(before)}</span>
                  <span className="mono">
                    {formatDuration(step.durationMs)}
                  </span>
                  <strong className={delta && delta > 300 ? "error" : ""}>
                    {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta}ms`}
                  </strong>
                </div>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}

function RunSummary({
  label,
  run,
}: {
  label: string;
  run?:
    | {
        id: string;
        status: string;
        createdAt: string;
        durationMs: number | null;
      }
    | ApiRun;
}) {
  return (
    <div>
      <span>{label}</span>
      {run ? (
        <>
          <div>
            <Link href={`/runs/${run.id}`}>{run.id.slice(-7)}</Link>
            <Status value={run.status} />
          </div>
          <small>
            {formatTime(run.createdAt)} · {formatDuration(run.durationMs)}
          </small>
        </>
      ) : (
        <>
          <strong>No successful baseline</strong>
          <small>Run pass mode once to create one.</small>
        </>
      )}
    </div>
  );
}
