import { NextResponse } from "next/server";
import { BackendApiError, backendFetch } from "./backend";

export async function proxyJson<T>(
  pathname: string,
  init: RequestInit = {},
  authenticated = init.method !== undefined && init.method !== "GET",
  timeoutMs = 8_000,
): Promise<NextResponse> {
  try {
    const body = await backendFetch<T>(pathname, init, {
      authenticated,
      timeoutMs,
    });
    return NextResponse.json(body);
  } catch (error) {
    const status = error instanceof BackendApiError ? error.status : 503;
    const message =
      error instanceof BackendApiError
        ? error.message
        : "FlowProof execution backend is unavailable";
    return NextResponse.json(
      { error: message },
      { status: status >= 400 && status <= 599 ? status : 503 },
    );
  }
}

export async function requestJson(request: Request): Promise<RequestInit> {
  return {
    method: request.method,
    headers: { "content-type": "application/json" },
    body:
      request.method === "GET"
        ? undefined
        : JSON.stringify(await request.json()),
  };
}
