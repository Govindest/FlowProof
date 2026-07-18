import { proxyJson, requestJson } from "../../../lib/proxy";

export async function POST(request: Request) {
  return proxyJson("/api/runbooks", await requestJson(request));
}
