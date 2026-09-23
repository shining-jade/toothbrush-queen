import { describe, expect, it } from "vitest";

import { skinOverlayStyle } from "@/features/admin/skin-upload/skin-calibration";

describe("skinOverlayStyle", () => {
  it("applies face-relative position, scale, and rotation", () => {
    expect(skinOverlayStyle(
      { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 5 },
      { anchorX: 0.1, anchorY: -0.4, scale: 1.5, rotationOffset: 10 },
    )).toMatchObject({
      left: "52%", top: "22%", width: "30%",
      transform: expect.stringContaining("15deg"),
    });
  });
});
