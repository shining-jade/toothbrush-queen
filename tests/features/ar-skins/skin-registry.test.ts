import { describe, expect, it } from "vitest";

import {
  BASIC_SKINS,
  resolveSessionSkin,
} from "@/features/ar-skins/skin-registry";

describe("AR skin registry", () => {
  it("offers the three basic animal skins in display order", () => {
    expect(BASIC_SKINS.map((skin) => skin.id)).toEqual(["cat", "rabbit", "bear"]);
  });

  it("keeps the student's choice before the final challenge day", () => {
    expect(resolveSessionSkin("rabbit", 3, 5)).toBe("rabbit");
  });

  it("forces the crown on the final challenge day", () => {
    expect(resolveSessionSkin("rabbit", 4, 5)).toBe("crown");
  });

  it("does not create a playable crown session after completion", () => {
    expect(resolveSessionSkin("bear", 5, 5)).toBe("bear");
  });
});
