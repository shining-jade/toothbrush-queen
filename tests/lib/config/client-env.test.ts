import { describe, expect, it } from "vitest";

import { getClientConfig } from "@/lib/config/client-env";

describe("getClientConfig", () => {
  it("rejects a missing Apps Script URL", () => {
    expect(() => getClientConfig({})).toThrow("NEXT_PUBLIC_APPS_SCRIPT_URL");
  });

  it("accepts an HTTPS Apps Script deployment URL", () => {
    expect(
      getClientConfig({
        NEXT_PUBLIC_APPS_SCRIPT_URL:
          "https://script.google.com/macros/s/example/exec",
      }),
    ).toEqual({
      appsScriptUrl: "https://script.google.com/macros/s/example/exec",
    });
  });
});
