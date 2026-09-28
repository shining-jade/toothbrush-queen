import { describe, expect, it } from "vitest";

import {
  BASIC_SKINS,
  mergeSkinCatalog,
  resolveSessionSkin,
} from "@/features/ar-skins/skin-registry";

describe("AR skin registry", () => {
  it("appends active remote skins after the bundled skin collection", () => {
    const catalog = mergeSkinCatalog([{
      skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://example.com/flower.png",
      anchorX: 0.1, anchorY: -0.4, scale: 1.5, rotationOffset: 10, version: 1, sortOrder: 10,
    }]);
    expect(catalog.map((skin) => skin.id)).toEqual([
      "cat", "rabbit", "bear",
      "bubble-crown", "toothpaste-hat", "detective-glasses",
      "tooth-fairy", "frog-hood", "photo-booth",
      "puppy-hood", "hamster-hood", "fox-hood",
      "panda-hood", "chick-hat", "penguin-hood",
      "skin-flower-1",
    ]);
    expect(catalog[15]).toMatchObject({ label: "꽃님 사진관", bundled: false, calibration: { scale: 1.5 } });
    expect(catalog[15].placement).toBeUndefined();
  });

  it("offers animal and original brushing-themed skins in display order", () => {
    expect(BASIC_SKINS.map((skin) => skin.id)).toEqual([
      "cat", "rabbit", "bear",
      "bubble-crown", "toothpaste-hat", "detective-glasses",
      "tooth-fairy", "frog-hood", "photo-booth",
      "puppy-hood", "hamster-hood", "fox-hood",
      "panda-hood", "chick-hat", "penguin-hood",
    ]);
  });

  it("offers former animal hoods as compact headbands above the face", () => {
    const headbandIds = [
      "frog-hood",
      "puppy-hood",
      "hamster-hood",
      "fox-hood",
      "panda-hood",
      "chick-hat",
      "penguin-hood",
    ];
    const headbands = BASIC_SKINS.filter((skin) => headbandIds.includes(skin.id));

    expect(headbands).toHaveLength(7);
    for (const skin of headbands) {
      expect(skin.label).toContain("머리띠");
      expect(skin.src).toContain("headband");
      expect(skin.placement).toBe("forehead");
      expect(skin.calibration.scale).toBeLessThanOrEqual(1.35);
    }
  });

  it("offers a wearable tooth tiara instead of a full face photo frame", () => {
    const wearable = BASIC_SKINS.find((skin) => skin.id === "photo-booth");

    expect(wearable).toMatchObject({
      label: "반짝 치아 티아라",
      src: "/ar-skins/tooth-tiara.png",
      placement: "forehead",
      calibration: { anchorY: 0.14 },
    });
  });

  it("assigns each bundled skin to the relevant facial landmark", () => {
    expect(BASIC_SKINS.filter((skin) => skin.placement === "face").map((skin) => skin.id))
      .toEqual(["cat", "rabbit", "bear", "tooth-fairy"]);
    expect(BASIC_SKINS.filter((skin) => skin.placement === "eyes").map((skin) => skin.id))
      .toEqual(["detective-glasses"]);
    expect(BASIC_SKINS.filter((skin) => skin.placement === "forehead").map((skin) => skin.id))
      .toEqual([
        "bubble-crown", "toothpaste-hat", "frog-hood", "photo-booth",
        "puppy-hood", "hamster-hood", "fox-hood", "panda-hood", "chick-hat", "penguin-hood",
      ]);
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
