import { describe, expect, it } from "vitest";

import { FacePresenceClock } from "@/features/ar-skins/face-presence-clock";

describe("FacePresenceClock", () => {
  it("caps stalled frame gaps and never exceeds elapsed brushing time", () => {
    const clock = new FacePresenceClock();
    clock.update({ nowMs: 0, visible: true, documentVisible: true });
    clock.update({ nowMs: 100, visible: true, documentVisible: true });
    clock.update({ nowMs: 10_100, visible: true, documentVisible: true });

    expect(clock.seconds(60)).toBeCloseTo(0.35, 2);
    expect(clock.seconds(0.2)).toBe(0.2);
  });

  it("does not count hidden document time", () => {
    const clock = new FacePresenceClock();
    clock.update({ nowMs: 0, visible: true, documentVisible: true });
    clock.update({ nowMs: 100, visible: true, documentVisible: true });
    clock.update({ nowMs: 10_100, visible: true, documentVisible: false });
    clock.update({ nowMs: 20_100, visible: true, documentVisible: true });

    expect(clock.seconds(60)).toBeCloseTo(0.1, 2);
  });

  it("does not count intervals ending without a detected face", () => {
    const clock = new FacePresenceClock();
    clock.update({ nowMs: 0, visible: true, documentVisible: true });
    clock.update({ nowMs: 100, visible: false, documentVisible: true });

    expect(clock.seconds(60)).toBe(0);
  });
});
