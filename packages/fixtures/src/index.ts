export const regressionKeys = [
  "offboard.permission-drift",
  "evaluation.ui-drift",
  "refund.missing-side-effect",
  "policy.incorrect-state",
  "evaluation.unexpected-initial-state",
  "evaluation.incorrect-sequence",
  "evaluation.cosmetic-change",
] as const;

export const initialDemoStates = {
  identity: {
    user: {
      id: "usr_alex",
      name: "Alex Morgan",
      email: "alex@northstar.test",
      disabled: false,
      canAccess: true,
    },
    githubMember: true,
  },
  billing: {
    order: {
      id: "ORD-1042",
      customer: "Maya Chen",
      amount: 249,
      status: "paid",
      confirmation: false,
      note: "",
      sequenceValid: true,
    },
    events: [] as string[],
  },
  policy: { targetUser: "Sam Rivera", role: "editor", forbidden: false },
} as const;
