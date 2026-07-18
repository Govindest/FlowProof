import { proxyJson, requestJson } from "../../../lib/proxy";

export async function GET() {
  return proxyJson("/api/fixtures", { method: "GET" }, false);
}

export async function POST(request: Request) {
  return proxyJson("/api/fixtures", await requestJson(request));
}
