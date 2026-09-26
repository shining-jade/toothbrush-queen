import { describe, expect, it } from "vitest";

import { boundedOverlayStyle } from "@/features/ar-skins/bounded-overlay";

describe("boundedOverlayStyle", () => {
  it("keeps a close face anchor attached instead of pulling the skin into the stage", () => {
    expect(boundedOverlayStyle(
      { centerX: 0.5, centerY: 0.15, width: 0.8, rotationDeg: 0 },
      { anchorX: 0, anchorY: -0.4, scale: 1.5, rotationOffset: 0 },
      { width: 320, height: 568 },
      { width: 600, height: 300 },
      8,
    )).toMatchObject({ left: "160px", top: "-96.56px", width: "460.8px" });
  });

  it("keeps an extreme rotated anchor attached to the face outside the stage", () => {
    const style = boundedOverlayStyle(
      { centerX: 0.95, centerY: 0.1, width: 0.8, rotationDeg: 80 },
      { anchorX: 0.5, anchorY: -0.5, scale: 1, rotationOffset: 10 },
      { width: 320, height: 568 },
      { width: 600, height: 300 },
      8,
    );

    expect(style).toMatchObject({ left: "432px", top: "-170.4px", width: "307.2px" });
    expect(style?.transform).toBe("translate3d(-50%, -50%, 0) rotate(90deg)");
  });

  it("returns no style until stage and image dimensions are valid", () => {
    const pose = { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 0 };
    const calibration = { anchorX: 0, anchorY: -0.4, scale: 1.4, rotationOffset: 0 };

    expect(boundedOverlayStyle(pose, calibration, { width: 0, height: 568 }, { width: 600, height: 300 }, 8)).toBeNull();
    expect(boundedOverlayStyle(pose, calibration, { width: 320, height: 568 }, { width: 0, height: 0 }, 8)).toBeNull();
  });
});
