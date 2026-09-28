import { describe, expect, it } from "vitest";

import { boundedOverlayStyle } from "@/features/ar-skins/bounded-overlay";

describe("boundedOverlayStyle", () => {
  const pose = {
    centerX: 0.5, centerY: 0.15, width: 0.8, height: 0.6,
    eyeCenterX: 0.48, eyeCenterY: 0.3,
    foreheadX: 0.5, foreheadY: 0.05,
    rotationDeg: 0,
  };

  it("keeps a close face anchor attached instead of pulling the skin into the stage", () => {
    expect(boundedOverlayStyle(
      pose,
      { anchorX: 0, anchorY: -0.4, scale: 1.5, rotationOffset: 0 },
      { width: 320, height: 568 },
      { width: 600, height: 300 },
      8,
    )).toMatchObject({ left: "160px", top: "-96.56px", width: "460.8px" });
  });

  it("keeps an extreme rotated anchor attached to the face outside the stage", () => {
    const style = boundedOverlayStyle(
      { ...pose, centerX: 0.95, centerY: 0.1, rotationDeg: 80 },
      { anchorX: 0.5, anchorY: -0.5, scale: 1, rotationOffset: 10 },
      { width: 320, height: 568 },
      { width: 600, height: 300 },
      8,
    );

    expect(style).toMatchObject({ left: "432px", top: "-170.4px", width: "307.2px" });
    expect(style?.transform).toBe("translate3d(-50%, -50%, 0) rotate(90deg)");
  });

  it("anchors face, eye, and forehead skins to their matching face geometry", () => {
    const calibration = { anchorX: 0, anchorY: -0.15, scale: 1, rotationOffset: 0 };
    const stage = { width: 320, height: 568 };
    const image = { width: 600, height: 300 };

    expect(boundedOverlayStyle(pose, calibration, stage, image, 8, "face"))
      .toMatchObject({ left: "160px", top: "34.08px" });
    expect(boundedOverlayStyle(pose, { ...calibration, anchorY: 0 }, stage, image, 8, "eyes"))
      .toMatchObject({ left: "153.6px", top: "170.4px" });
    expect(boundedOverlayStyle(pose, { ...calibration, anchorY: 0.15 }, stage, image, 8, "forehead"))
      .toMatchObject({ left: "160px", top: "79.52px" });
  });

  it("returns no style until stage and image dimensions are valid", () => {
    const invalidPose = { ...pose, centerY: 0.3, width: 0.2 };
    const calibration = { anchorX: 0, anchorY: -0.4, scale: 1.4, rotationOffset: 0 };

    expect(boundedOverlayStyle(invalidPose, calibration, { width: 0, height: 568 }, { width: 600, height: 300 }, 8)).toBeNull();
    expect(boundedOverlayStyle(invalidPose, calibration, { width: 320, height: 568 }, { width: 0, height: 0 }, 8)).toBeNull();
  });
});
