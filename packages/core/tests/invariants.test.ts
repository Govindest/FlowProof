import { describe, expect, it } from "vitest";
import { evaluateInvariant, getPath, type Invariant } from "../src";

const invariant: Invariant = {
  id: "refund",
  name: "Order refunded",
  endpoint: "/state",
  path: "order.status",
  operator: "equals",
  expected: "refunded",
};

describe("invariant engine", () => {
  it("reads nested paths", () =>
    expect(getPath({ order: { status: "paid" } }, "order.status")).toBe(
      "paid",
    ));
  it("passes equal values", () =>
    expect(
      evaluateInvariant(invariant, { order: { status: "refunded" } }).status,
    ).toBe("PASS"));
  it("reports actual value on failure", () =>
    expect(
      evaluateInvariant(invariant, { order: { status: "paid" } }),
    ).toMatchObject({ status: "FAIL", actual: "paid" }));
});
