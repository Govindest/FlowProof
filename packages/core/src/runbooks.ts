import YAML from "yaml";
import { runbookSchema, type Runbook } from "./schema";

export function parseRunbook(source: string): Runbook {
  const parsed: unknown = YAML.parse(source);
  return runbookSchema.parse(parsed);
}

export function stringifyRunbook(runbook: Runbook): string {
  return YAML.stringify(runbook, { lineWidth: 0 });
}
