"use client";

import { useState } from "react";

const starter = `version: 1
name: Verify critical workflow
slug: verify-critical-workflow
description: Verify a critical browser workflow and its business outcome.
targetApps:
  - demo
credentialsRef: demo-local
severity: high
steps:
  - id: open
    name: Open target app
    action: goto
    path: /identity
invariants:
  - id: reachable
    name: User record is reachable
    endpoint: /api/demo/identity
    path: user.id
    operator: truthy
`;

export function RunbookEditor() {
  const [mode, setMode] = useState<"yaml" | "natural">("natural");
  const [prompt, setPrompt] = useState(
    "When a contractor leaves, disable their identity, revoke repository access, and prove they cannot reach the company dashboard.",
  );
  const [yaml, setYaml] = useState(starter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function compile() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/compile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const body = (await response.json()) as { yaml?: string; error?: string };
    setBusy(false);
    if (!response.ok || !body.yaml)
      return setError(body.error ?? "Compilation failed");
    setYaml(body.yaml);
    setMode("yaml");
  }

  async function save() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/runbooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml }),
    });
    const body = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(body.error ?? "Could not save runbook");
    }
    window.location.href = "/";
  }

  return (
    <section className="panel">
      <div className="tabs" role="tablist" aria-label="Runbook input mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "natural"}
          onClick={() => setMode("natural")}
        >
          Plain language
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "yaml"}
          onClick={() => setMode("yaml")}
        >
          YAML
        </button>
      </div>
      {mode === "natural" ? (
        <>
          <div className="field">
            <label htmlFor="prompt">What should FlowProof verify?</label>
            <textarea
              className="prose"
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <small>
              Seeded GPT-5.6 mode compiles deterministically. Add OpenAI
              credentials for live GPT-5.6 compilation.
            </small>
          </div>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void compile()}
          >
            {busy ? "Compiling…" : "Compile to YAML"}
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="yaml">Runbook YAML</label>
            <textarea
              id="yaml"
              spellCheck={false}
              value={yaml}
              onChange={(event) => setYaml(event.target.value)}
            />
            <small>Validated with strict Zod schema before save.</small>
          </div>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save runbook"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error form-message">
          {error}
        </p>
      )}
    </section>
  );
}
