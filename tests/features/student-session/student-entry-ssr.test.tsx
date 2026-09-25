// @vitest-environment node

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudentEntry } from "@/features/student-session/student-entry";

describe("StudentEntry server rendering", () => {
  it("renders its loading state without accessing browser storage", () => {
    process.env.NEXT_PUBLIC_APPS_SCRIPT_URL = "https://script.google.com/macros/s/test/exec";

    expect(() => renderToString(<StudentEntry challengeId="ABC123" />)).not.toThrow();
  });
});
