"use client";

import { useEffect, useState } from "react";

type Identity = {
  user: { name: string; email: string; disabled: boolean; canAccess: boolean };
  githubMember: boolean;
  selectorDrift?: boolean;
  cosmeticChange?: boolean;
};
type Billing = {
  order: {
    id: string;
    customer: string;
    amount: number;
    status: string;
    confirmation: boolean;
    note: string;
    sequenceValid: boolean;
  };
};
type Policy = { targetUser: string; role: string; forbidden: boolean };

async function request<T>(flow: string, action?: string): Promise<T> {
  const response = await fetch(
    `/api/demo/${flow}`,
    action
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        }
      : undefined,
  );
  if (!response.ok) throw new Error("Demo action failed");
  return response.json() as Promise<T>;
}

function Shell({
  product,
  eyebrow,
  children,
}: {
  product: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <main className="demo">
      <header>
        <div className="brand">
          Northstar <span>{product}</span>
        </div>
        <div className="avatar" aria-label="Signed in as Operations Admin">
          OA
        </div>
      </header>
      <section className="breadcrumb">Operations / {eyebrow}</section>
      {children}
    </main>
  );
}

export function IdentityApp() {
  const [state, setState] = useState<Identity>();
  const [login, setLogin] = useState("Not tested");
  useEffect(() => {
    void request<Identity>("identity").then(setState);
  }, []);
  if (!state)
    return (
      <Shell product="Identity" eyebrow="People">
        <section className="card">Loading identity…</section>
      </Shell>
    );
  const act = (action: string) =>
    request<Identity>("identity", action).then(setState);
  return (
    <Shell product="Identity" eyebrow="Contractor access">
      <section className={`card${state.cosmeticChange ? " refreshed" : ""}`}>
        {state.cosmeticChange && (
          <p className="cosmetic-note">Refreshed profile layout</p>
        )}
        <div className="card-head">
          <div>
            <p className="overline">Contractor profile</p>
            <h1>{state.user.name}</h1>
            <p>{state.user.email}</p>
          </div>
          <span
            data-testid="identity-status"
            className={`pill ${state.user.disabled ? "danger" : "good"}`}
          >
            {state.user.disabled ? "Disabled" : "Active"}
          </span>
        </div>
        <dl>
          <div>
            <dt>Account type</dt>
            <dd>Contractor</dd>
          </div>
          <div>
            <dt>Repository organization</dt>
            <dd data-testid="repository-membership">
              {state.githubMember ? "Member" : "Removed"}
            </dd>
          </div>
        </dl>
        <div className="actions">
          <button
            data-testid={
              state.selectorDrift ? "disable-user-v2" : "disable-user"
            }
            onClick={() => void act("disable")}
          >
            Disable user
          </button>
          <button
            data-testid="revoke-github"
            className="secondary"
            onClick={() => void act("revoke")}
          >
            Revoke repository access
          </button>
        </div>
      </section>
      <section className="card">
        <div className="card-head">
          <div>
            <p className="overline">Access check</p>
            <h2>Contractor dashboard</h2>
          </div>
          <button
            data-testid="test-login"
            className="secondary"
            onClick={() =>
              setLogin(
                state.user.canAccess ? "Dashboard granted" : "Access denied",
              )
            }
          >
            Test Alex login
          </button>
        </div>
        <div data-testid="login-result" className="result">
          {login}
        </div>
      </section>
    </Shell>
  );
}

export function BillingApp() {
  const [state, setState] = useState<Billing>();
  useEffect(() => {
    void request<Billing>("billing").then(setState);
  }, []);
  if (!state)
    return (
      <Shell product="Billing" eyebrow="Orders">
        <section className="card">Loading order…</section>
      </Shell>
    );
  const act = (action: string) =>
    request<Billing>("billing", action).then(setState);
  const order = state.order;
  return (
    <Shell product="Billing" eyebrow={order.id}>
      <section className="card">
        <div className="card-head">
          <div>
            <p className="overline">Order {order.id}</p>
            <h1>{order.customer}</h1>
            <p>Annual workspace subscription</p>
          </div>
          <div className="amount">${order.amount}.00</div>
        </div>
        <dl>
          <div>
            <dt>Payment status</dt>
            <dd data-testid="refund-status">
              {order.status === "refunded" ? "Refunded" : "Paid"}
            </dd>
          </div>
          <div>
            <dt>Customer confirmation</dt>
            <dd>{order.confirmation ? "Sent" : "Not sent"}</dd>
          </div>
          <div>
            <dt>Internal note</dt>
            <dd>{order.note || "None"}</dd>
          </div>
        </dl>
        <div className="actions">
          <button data-testid="issue-refund" onClick={() => void act("refund")}>
            Issue full refund
          </button>
          <button
            data-testid="send-confirmation"
            className="secondary"
            onClick={() => void act("confirmation")}
          >
            Send confirmation
          </button>
          <button
            data-testid="create-note"
            className="secondary"
            onClick={() => void act("note")}
          >
            Create internal note
          </button>
        </div>
      </section>
    </Shell>
  );
}

export function PolicyApp() {
  const [state, setState] = useState<Policy>();
  const [result, setResult] = useState("Not tested");
  useEffect(() => {
    void request<Policy>("policy").then(setState);
  }, []);
  if (!state)
    return (
      <Shell product="Access" eyebrow="Role bindings">
        <section className="card">Loading policy…</section>
      </Shell>
    );
  const act = (action: string) =>
    request<Policy>("policy", action).then(setState);
  return (
    <Shell product="Access" eyebrow="Production workspace">
      <section className="card">
        <div className="card-head">
          <div>
            <p className="overline">Role binding</p>
            <h1>{state.targetUser}</h1>
            <p>Sensitive production workspace</p>
          </div>
          <span className="pill">{state.role}</span>
        </div>
        <dl>
          <div>
            <dt>Current role</dt>
            <dd>{state.role}</dd>
          </div>
          <div>
            <dt>Protected page</dt>
            <dd>/finance/export</dd>
          </div>
        </dl>
        <div className="actions">
          <button
            data-testid="change-binding"
            onClick={() => void act("change")}
          >
            Change binding to viewer
          </button>
          <button
            data-testid="test-policy"
            className="secondary"
            onClick={() =>
              setResult(
                state.forbidden ? "403 Forbidden" : "200 Access granted",
              )
            }
          >
            Test protected page
          </button>
        </div>
        <div data-testid="policy-result" className="result">
          {result}
        </div>
      </section>
    </Shell>
  );
}
