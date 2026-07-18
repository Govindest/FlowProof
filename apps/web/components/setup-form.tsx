"use client";

import { useEffect, useState } from "react";

export function SetupForm() {
  const [repository, setRepository] = useState("");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((data: { repository: string; connected: boolean }) => {
        setRepository(data.repository);
        setConnected(data.connected);
      });
  }, []);
  async function save() {
    setMessage("");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repository, token }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok)
      return setMessage(body.error ?? "Could not save integration");
    setConnected(Boolean(token) || connected);
    setToken("");
    setMessage("GitHub settings saved.");
  }
  return (
    <section className="panel setup-panel">
      <div className="integration-head">
        <span className="github-mark">GH</span>
        <div>
          <h2>GitHub Issues</h2>
          <p>
            Publish failed-run evidence as an issue. Draft generation works
            without connection.
          </p>
        </div>
        <span className={connected ? "connected" : "optional"}>
          {connected ? "Connected" : "Optional"}
        </span>
      </div>
      <div className="field">
        <label htmlFor="repository">Repository</label>
        <input
          id="repository"
          placeholder="owner/repository"
          value={repository}
          onChange={(event) => setRepository(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="token">Fine-grained personal access token</label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          placeholder={connected ? "•••••••••••• (saved)" : "github_pat_…"}
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <small>Needs Issues: read and write. Never displayed after save.</small>
      </div>
      <button className="button" type="button" onClick={() => void save()}>
        Save integration
      </button>
      {message && (
        <p
          role="status"
          className={
            message.includes("saved")
              ? "success form-message"
              : "error form-message"
          }
        >
          {message}
        </p>
      )}
    </section>
  );
}
