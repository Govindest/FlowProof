import { NextResponse } from "next/server";
import { db, getDemoState, setDemoState } from "@flowproof/core";
import { initialDemoStates } from "@flowproof/fixtures";

type Flow = keyof typeof initialDemoStates;
type IdentityState = {
  user: {
    id: string;
    name: string;
    email: string;
    disabled: boolean;
    canAccess: boolean;
  };
  githubMember: boolean;
};
type BillingState = {
  order: {
    id: string;
    customer: string;
    amount: number;
    status: string;
    confirmation: boolean;
    note: string;
    sequenceValid: boolean;
  };
  events: string[];
};
type PolicyState = { targetUser: string; role: string; forbidden: boolean };

async function read(flow: Flow) {
  const value = await getDemoState(flow, initialDemoStates[flow]);
  if (flow === "identity") {
    const regressions = await db.regression.findMany({
      where: {
        key: { in: ["evaluation.ui-drift", "evaluation.cosmetic-change"] },
        enabled: true,
      },
    });
    const active = new Set(regressions.map((item) => item.key));
    return {
      ...value,
      selectorDrift: active.has("evaluation.ui-drift"),
      cosmeticChange: active.has("evaluation.cosmetic-change"),
    };
  }
  return value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ flow: string }> },
) {
  const { flow } = await context.params;
  if (!(flow in initialDemoStates))
    return NextResponse.json({ error: "Unknown flow" }, { status: 404 });
  return NextResponse.json(await read(flow as Flow));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ flow: string }> },
) {
  const { flow } = await context.params;
  if (!(flow in initialDemoStates))
    return NextResponse.json({ error: "Unknown flow" }, { status: 404 });
  const { action } = (await request.json()) as { action?: string };

  if (flow === "identity") {
    const state = await getDemoState<IdentityState>(
      "identity",
      initialDemoStates.identity,
    );
    if (action === "disable")
      state.user = { ...state.user, disabled: true, canAccess: false };
    if (action === "revoke") {
      const blocked = await db.regression.findUnique({
        where: { key: "offboard.permission-drift" },
      });
      if (!blocked?.enabled) state.githubMember = false;
    }
    await setDemoState("identity", state);
  } else if (flow === "billing") {
    const state = await getDemoState<BillingState>(
      "billing",
      initialDemoStates.billing,
    );
    if (action === "refund") {
      const wrongOrder = await db.regression.findUnique({
        where: { key: "evaluation.incorrect-sequence" },
      });
      state.order = {
        ...state.order,
        status: "refunded",
        sequenceValid:
          state.order.sequenceValid &&
          !state.events.includes("confirmation") &&
          !wrongOrder?.enabled,
      };
      state.events.push("refund");
    }
    if (action === "confirmation") {
      state.order = {
        ...state.order,
        confirmation: true,
        sequenceValid:
          state.order.sequenceValid && state.order.status === "refunded",
      };
      state.events.push("confirmation");
    }
    if (action === "note") {
      const broken = await db.regression.findUnique({
        where: { key: "refund.missing-side-effect" },
      });
      if (!broken?.enabled)
        state.order = { ...state.order, note: "Refund approved by Operations" };
    }
    await setDemoState("billing", state);
  } else {
    const state = await getDemoState<PolicyState>(
      "policy",
      initialDemoStates.policy,
    );
    if (action === "change") {
      const broken = await db.regression.findUnique({
        where: { key: "policy.incorrect-state" },
      });
      Object.assign(
        state,
        broken?.enabled
          ? { role: "viewer", forbidden: false }
          : { role: "viewer", forbidden: true },
      );
    }
    await setDemoState("policy", state);
  }

  return NextResponse.json(await read(flow as Flow));
}
