import { proxyJson, requestJson } from "../../../lib/proxy";

export async function POST(request: Request) {
  return proxyJson("/api/compile", await requestJson(request), true, 60_000);
}
