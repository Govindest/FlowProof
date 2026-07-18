import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { BackendConfig } from "@flowproof/core";

export function hasValidSharedSecret(
  request: Pick<IncomingMessage, "headers">,
  expected: string,
): boolean {
  const supplied = request.headers["x-flowproof-secret"];
  if (typeof supplied !== "string") return false;
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function corsHeaders(
  request: Pick<IncomingMessage, "headers">,
  config: BackendConfig,
): Record<string, string> | null {
  const origin = request.headers.origin;
  if (!origin) return {};
  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return null;
  }
  if (!config.allowedOrigins.includes(normalized)) return null;
  return {
    "access-control-allow-origin": normalized,
    vary: "Origin",
  };
}
