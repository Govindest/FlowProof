import type { Invariant, InvariantResult } from "./schema";

export function getPath(input: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value)
      return (value as Record<string, unknown>)[key];
    return undefined;
  }, input);
}

export function evaluateInvariant(
  invariant: Invariant,
  payload: unknown,
): InvariantResult {
  const actual = getPath(payload, invariant.path);
  const passed =
    invariant.operator === "equals"
      ? Object.is(actual, invariant.expected)
      : invariant.operator === "notEquals"
        ? !Object.is(actual, invariant.expected)
        : invariant.operator === "includes"
          ? Array.isArray(actual) && actual.includes(invariant.expected)
          : Boolean(actual);

  return {
    id: invariant.id,
    name: invariant.name,
    status: passed ? "PASS" : "FAIL",
    expected: invariant.operator === "truthy" ? true : invariant.expected,
    actual,
    message: passed
      ? "Invariant satisfied"
      : `Expected ${JSON.stringify(invariant.expected ?? true)}, received ${JSON.stringify(actual)}`,
  };
}
