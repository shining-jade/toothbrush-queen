import { describe, expect, it, vi } from "vitest";

import {
  createToothbrushLikeDetector,
  isToothbrushLikeChange,
  type PixelFrame,
} from "@/features/brushing-session/toothbrush-like-detector";

function frame(rect?: { x: number; y: number; width: number; height: number }): PixelFrame {
  const width = 32;
  const height = 24;
  const data = new Uint8ClampedArray(width * height * 4).fill(100);
  for (let pixel = 3; pixel < data.length; pixel += 4) data[pixel] = 255;
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 230;
        data[offset + 1] = 230;
        data[offset + 2] = 230;
      }
    }
  }
  return { width, height, data };
}

const pose = { centerX: 0.5, centerY: 0.2, width: 0.3, rotationDeg: 0 };
const video = {} as HTMLVideoElement;

describe("toothbrush-like image change", () => {
  it("accepts a thin elongated change but rejects broad face movement", () => {
    const baseline = frame();
    expect(isToothbrushLikeChange(baseline, frame({ x: 5, y: 10, width: 20, height: 2 }))).toBe(true);
    expect(isToothbrushLikeChange(baseline, frame({ x: 8, y: 5, width: 14, height: 14 }))).toBe(false);
  });

  it("requires the candidate to persist for 800ms and resets after loss", () => {
    const readFrame = vi.fn()
      .mockReturnValueOnce(frame())
      .mockReturnValueOnce(frame({ x: 5, y: 10, width: 20, height: 2 }))
      .mockReturnValueOnce(frame({ x: 5, y: 10, width: 20, height: 2 }))
      .mockReturnValueOnce(frame())
      .mockReturnValueOnce(frame({ x: 5, y: 10, width: 20, height: 2 }));
    const detector = createToothbrushLikeDetector({ readFrame, holdMs: 800 });

    expect(detector.observe(video, pose, 0)).toBe(false);
    expect(detector.observe(video, pose, 100)).toBe(false);
    expect(detector.observe(video, pose, 900)).toBe(true);
    expect(detector.observe(video, pose, 1_000)).toBe(false);
    expect(detector.observe(video, pose, 1_900)).toBe(false);
  });

  it("can be reset and safely ignores unavailable canvas frames", () => {
    const readFrame = vi.fn().mockReturnValue(null);
    const detector = createToothbrushLikeDetector({ readFrame });

    expect(detector.observe(video, pose, 0)).toBe(false);
    expect(() => detector.reset()).not.toThrow();
  });
});
