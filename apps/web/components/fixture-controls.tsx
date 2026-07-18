"use client";

import { useEffect, useState } from "react";

type Regression = { key: string; enabled: boolean };
const copy: Record<string, { title: string; flow: string; detail: string }> = {
  "offboard.permission-drift": {
    title: "Repository permission drift",
    flow: "Offboard Contractor · demo loop",
    detail:
      "Revocation click succeeds, but repository membership remains. Business invariant catches retained access.",
  },
  "evaluation.ui-drift": {
    title: "UI selector drift",
    flow: "Offboard Contractor · evaluation",
    detail:
      "Renames Disable user selector. Browser replay stops with screenshot and trace.",
  },
  "refund.missing-side-effect": {
    title: "Missing side effect",
    flow: "Refund Customer",
    detail:
      "Internal note action appears successful but note is never persisted.",
  },
  "policy.incorrect-state": {
    title: "Permission state drift",
    flow: "Access Policy Drift",
    detail: "Role update is ignored, leaving protected page accessible.",
  },
  "evaluation.unexpected-initial-state": {
    title: "Unexpected initial state",
    flow: "Refund Customer · evaluation",
    detail:
      "Order starts refunded, violating the required paid precondition before mutations begin.",
  },
  "evaluation.incorrect-sequence": {
    title: "Incorrect step sequence",
    flow: "Refund Customer · evaluation",
    detail: "Sequencer records customer confirmation before refund completion.",
  },
  "evaluation.cosmetic-change": {
    title: "Non-breaking cosmetic change",
    flow: "Offboard Contractor · evaluation",
    detail:
      "Refreshes profile styling without changing selectors or business state. Expected result remains PASS.",
  },
};

export function FixtureControls() {
  const [items, setItems] = useState<Regression[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/fixtures")
      .then(async (response) => {
        if (!response.ok) throw new Error("backend unavailable");
        setItems((await response.json()) as Regression[]);
      })
      .catch(() =>
        setMessage("Execution backend unavailable. Refresh to retry."),
      );
  }, []);

  async function toggle(item: Regression) {
    setItems((all) =>
      all.map((value) =>
        value.key === item.key ? { ...value, enabled: !value.enabled } : value,
      ),
    );
    const response = await fetch("/api/fixtures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: item.key, enabled: !item.enabled }),
    });
    if (!response.ok)
      setItems((all) =>
        all.map((value) => (value.key === item.key ? item : value)),
      );
    if (!response.ok)
      setMessage("Could not update the fixture. Backend unavailable.");
    else setMessage("");
  }

  async function reset() {
    const response = await fetch("/api/fixtures/reset", { method: "POST" });
    if (!response.ok) {
      setMessage("Could not reset fixtures. Backend unavailable.");
      return;
    }
    setItems((all) => all.map((item) => ({ ...item, enabled: false })));
    setMessage("All demos reset to pass mode.");
  }

  return (
    <>
      <section className="fixture-list" aria-busy={!items.length}>
        {items.map((item) => {
          const info = copy[item.key];
          return (
            <article
              className={item.enabled ? "fixture active" : "fixture"}
              key={item.key}
            >
              <div className="fixture-top">
                <span className="workflow-icon">{info?.flow.slice(0, 1)}</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => void toggle(item)}
                    aria-label={`Inject ${info?.title}`}
                  />
                  <span />
                </label>
              </div>
              <p className="eyebrow">{info?.flow}</p>
              <h2>{info?.title}</h2>
              <p>{info?.detail}</p>
              <div className="fixture-state">
                <span
                  className={item.enabled ? "state-broken" : "state-clean"}
                />
                {item.enabled ? "Regression injected" : "Pass mode"}
              </div>
            </article>
          );
        })}
      </section>
      <div className="fixture-actions">
        <button
          className="button secondary"
          type="button"
          onClick={() => void reset()}
        >
          Reset all to pass mode
        </button>
        {message && (
          <span
            role="status"
            className={
              message.includes("unavailable") || message.includes("Could not")
                ? "error"
                : "success"
            }
          >
            {message}
          </span>
        )}
      </div>
    </>
  );
}
