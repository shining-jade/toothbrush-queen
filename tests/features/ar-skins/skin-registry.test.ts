import { describe, expect, it } from "vitest";

import {
  BASIC_SKINS,
  mergeSkinCatalog,
  resolveSessionSkin,
} from "@/features/ar-skins/skin-registry";

describe("AR skin registry", () => {
  it("appends active remote skins after the three bundled fallbacks", () => {
    const catalog = mergeSkinCatalog([{
      skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://example.com/flower.png",
      anchorX: 0.1, anchorY: -0.4, scale: 1.5, rotationOffset: 10, version: 1, sortOrder: 10,
    }]);
    expect(catalog.map((skin) => skin.id)).toEqual(["cat", "rabbit", "bear", "skin-flower-1"]);
    expect(catalog[3]).toMatchObject({ label: "꽃님 사진관", bundled: false, calibration: { scale: 1.5 } });
  });

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
