import { proxyJson, requestJson } from "../../../lib/proxy";

export async function GET() {
  return proxyJson("/api/settings", { method: "GET" }, false);
}

export async function POST(request: Request) {
  return proxyJson("/api/settings", await requestJson(request));
}
