import Link from "next/link";
import { backendFetch, type DashboardData } from "../lib/backend";
import {
  EmptyState,
  formatDuration,
  formatTime,
  Status,
  VerifyButton,
} from "../components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  let data: DashboardData;
  try {
    data = await backendFetch<DashboardData>("/api/dashboard");
  } catch {
    return (
      <main>
        <section className="empty backend-unavailable" role="alert">
          <h1>Execution backend unavailable</h1>
          <p>
            FlowProof could not reach the persistent browser worker. Check the
            Railway service and refresh this page.
          </p>
        </section>
      </main>
    );
  }
  const { runbooks, recent, evaluation } = data;
  const passed = recent.filter((run) => run.status === "PASS").length;

  return (
    <main>
      <div className="page-head">
        <div>
          <p className="eyebrow">CI FOR BUSINESS OPERATIONS</p>
          <h1>Critical work, proven.</h1>
          <p>
            Continuously replay browser workflows, verify real business
            outcomes, and keep evidence when they break.
          </p>
        </div>
        <div className="head-actions">
          <form action="/api/demo" method="post">
            <button className="button" type="submit">
              ▶ Run failure demo
            </button>
          </form>
          <Link href="/runbooks/new" className="button secondary">
            ＋ New runbook
          </Link>
        </div>
      </div>

      <section className="metrics" aria-label="Workspace summary">
        <div>
          <span>Protected workflows</span>
          <strong>{runbooks.length}</strong>
          <small>Across 3 demo systems</small>
        </div>
        <div>
          <span>Recent pass rate</span>
          <strong>
            {recent.length ? Math.round((passed / recent.length) * 100) : 100}%
          </strong>
          <small>Last {recent.length || 0} verifications</small>
        </div>
        <div>
          <span>Evidence retained</span>
          <strong>{recent.filter((run) => run.resultJson).length}</strong>
          <small>Trace-backed runs</small>
        </div>
      </section>

      <section
        className="evaluation-strip"
        aria-label="Seeded evaluation summary"
      >
        <div>
          <p className="eyebrow">EXECUTED EVALUATION</p>
          <h2>
            {evaluation.summary.expectationsMet}/
            {evaluation.summary.totalCases || 6} expected outcomes
          </h2>
          <p>
            {evaluation.generatedAt
              ? `Generated ${formatTime(evaluation.generatedAt)} in ${evaluation.providerMode} mode.`
              : "Run pnpm evaluate to generate measured results."}
          </p>
        </div>
        <dl>
          <div>
            <dt>Faults detected</dt>
            <dd>{evaluation.summary.faultsDetected}/5</dd>
          </div>
          <div>
            <dt>Correct invariant</dt>
            <dd>{evaluation.summary.correctInvariantIdentifications}/5</dd>
          </div>
          <div>
            <dt>Evidence complete</dt>
            <dd>
              {evaluation.summary.evidencePacketsComplete}/
              {evaluation.summary.totalCases || 6}
            </dd>
          </div>
          <div>
            <dt>Diagnosis cited evidence</dt>
            <dd>{evaluation.summary.diagnosesReferencingEvidence}/5</dd>
          </div>
        </dl>
        <Link href="/fixtures">View fault controls</Link>
      </section>

      <section className="judge-card" aria-labelledby="judge-title">
        <div>
          <p className="eyebrow">JUDGE TEST PATH · NO LOGIN</p>
          <h2 id="judge-title">See silent access drift become proof</h2>
          <p>
            Seeded demo applications only. No real user, repository, or customer
            account is changed.
          </p>
        </div>
        <ol>
          <li>Click Run failure demo.</li>
          <li>
            Wait for FAIL, then inspect <code>membership-removed</code>, a
            screenshot, trace, and GPT-5.6 diagnosis.
          </li>
          <li>Click Repair &amp; rerun and confirm PASS.</li>
          <li>Use Fixture control to reset or replay.</li>
        </ol>
        <div className="judge-actions">
          <form action="/api/demo" method="post">
            <button className="button" type="submit">
              Run failure demo
            </button>
          </form>
          <Link href="/fixtures" className="button secondary">
            Reset demo
          </Link>
        </div>
      </section>

      <div className="section-head">
        <div>
          <h2>Runbooks</h2>
          <p>Operational workflows under continuous proof.</p>
        </div>
      </div>
      {runbooks.length ? (
        <section className="workflow-list">
          <div className="table-head">
            <span>Workflow</span>
            <span>Severity</span>
            <span>Latest result</span>
            <span>Duration</span>
            <span />
          </div>
          {runbooks.map((runbook) => {
            const latest = runbook.runs[0];
            return (
              <article className="workflow-row" key={runbook.id}>
                <Link
                  className="workflow-name"
                  href={
                    latest
                      ? `/runs/${latest.id}`
                      : `/runbooks/${runbook.id}/compare`
                  }
                >
                  <span className="workflow-icon">
                    {runbook.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{runbook.name}</strong>
                    <small>{runbook.description}</small>
                  </span>
                </Link>
                <span className={`severity severity-${runbook.severity}`}>
                  {runbook.severity}
                </span>
                <span>
                  {latest ? (
                    <Status value={latest.status} />
                  ) : (
                    <span className="muted">Never run</span>
                  )}
                  <small>
                    {latest ? formatTime(latest.createdAt) : "Ready to verify"}
                  </small>
                </span>
                <span className="mono">
                  {formatDuration(latest?.durationMs)}
                </span>
                <VerifyButton runbookId={runbook.id} compact />
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState />
      )}

      <div className="section-head">
        <div>
          <h2>Recent activity</h2>
          <p>Latest proof generated by browser workers.</p>
        </div>
      </div>
      <section className="activity">
        {recent.length ? (
          recent.map((run) => (
            <Link href={`/runs/${run.id}`} key={run.id}>
              <Status value={run.status} />
              <span>
                <strong>{run.runbook.name}</strong>
                <small>
                  {run.status === "PASS"
                    ? "All invariants satisfied"
                    : (run.explanation ?? "Verification queued")}
                </small>
              </span>
              <time>{formatTime(run.createdAt)}</time>
              <b aria-hidden="true">›</b>
            </Link>
          ))
        ) : (
          <p className="muted">
            No verifications yet. Run any workflow to create proof.
          </p>
        )}
      </section>
    </main>
  );
}
