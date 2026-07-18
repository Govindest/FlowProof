import { describe, expect, it } from "vitest";
import { getBackendBaseUrl } from "../lib/backend";

describe("web backend URL", () => {
  it("uses the local backend by default", () => {
    expect(getBackendBaseUrl({})).toBe("http://127.0.0.1:3200");
  });

  it("normalizes the configured Railway URL", () => {
    expect(
      getBackendBaseUrl({
        NEXT_PUBLIC_FLOWPROOF_API_URL: "https://flowproof.up.railway.app/",
      }),
    ).toBe("https://flowproof.up.railway.app");
  });

  it("rejects non-HTTP protocols", () => {
    expect(() =>
      getBackendBaseUrl({ NEXT_PUBLIC_FLOWPROOF_API_URL: "file:///data" }),
    ).toThrow(/HTTP or HTTPS/);
  });
});
