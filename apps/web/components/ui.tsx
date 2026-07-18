import Link from "next/link";

export function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M5 12.5 9.2 17 19 6.5" />
      </svg>
    </span>
  );
}

export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <span aria-hidden="true" />
      {value}
    </span>
  );
}

export function VerifyButton({
  runbookId,
  compact = false,
}: {
  runbookId: string;
  compact?: boolean;
}) {
  return (
    <form action="/api/runs" method="post">
      <input type="hidden" name="runbookId" value={runbookId} />
      <button className={compact ? "button small" : "button"} type="submit">
        <span aria-hidden="true">▶</span> Verify now
      </button>
    </form>
  );
}

export function EmptyState() {
  return (
    <section className="empty">
      <Mark />
      <h2>No runbooks yet</h2>
      <p>Create one from YAML or plain language.</p>
      <Link className="button" href="/runbooks/new">
        Create runbook
      </Link>
    </section>
  );
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}
