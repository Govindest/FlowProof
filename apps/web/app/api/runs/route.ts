import { NextResponse } from "next/server";
import { BackendApiError, backendFetch } from "../../../lib/backend";

export async function POST(request: Request) {
  const form = await request.formData();
  const runbookId = String(form.get("runbookId") ?? "");
  try {
    const run = await backendFetch<{ id: string }>(
      "/api/runs",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runbookId }),
      },
      { authenticated: true },
    );
    return NextResponse.redirect(new URL(`/runs/${run.id}`, request.url), 303);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BackendApiError
            ? error.message
            : "Execution backend unavailable",
      },
      { status: error instanceof BackendApiError ? error.status : 503 },
    );
  }
}
