import { describe, expect, it } from "vitest";

import { constrainTimerPosition } from "@/features/brushing-session/adjustable-countdown";

describe("constrainTimerPosition", () => {
  it("keeps the entire timer inside the stage near the top-right edge", () => {
    expect(constrainTimerPosition(
      { x: 319, y: 1 },
      { left: 0, top: 0, width: 320, height: 360 },
      { width: 120, height: 52 },
      12,
    )).toEqual({ x: 77.5, y: 10.555555555555555 });
  });
});
