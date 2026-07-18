import { proxyJson } from "../../../../lib/proxy";

export async function POST() {
  return proxyJson("/api/fixtures/reset", { method: "POST" });
}
