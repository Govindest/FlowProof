import { NextResponse } from "next/server";
import { getBackendBaseUrl } from "../../../../lib/backend";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const parts = (await context.params).path;
  try {
    const target = new URL(
      `/api/artifacts/${parts.map(encodeURIComponent).join("/")}`,
      getBackendBaseUrl(),
    );
    const response = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const headers = new Headers();
    for (const key of [
      "content-type",
      "content-disposition",
      "cache-control",
      "x-content-type-options",
    ]) {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new NextResponse(response.body, { status: response.status, headers });
  } catch {
    return NextResponse.json(
      { error: "Artifact backend unavailable" },
      { status: 503 },
    );
  }
}
