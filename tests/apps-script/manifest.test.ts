import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Apps Script manifest", () => {
  it("declares a public owner-executed web app entry point", () => {
    const manifest = JSON.parse(readFileSync(resolve("apps-script/appsscript.json"), "utf8"));

    expect(manifest.webapp).toEqual({
      access: "ANYONE_ANONYMOUS",
      executeAs: "USER_DEPLOYING",
    });
  });
});
