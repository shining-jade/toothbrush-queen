import { describe, expect, it } from "vitest";

import {
  facePoseFromLandmarks,
  mirrorPose,
  smoothFacePose,
} from "@/features/ar-skins/face-pose";

type Point = [number, number];

function makeLandmarks({
  leftEye,
  rightEye,
  forehead,
  chin,
  leftEdge,
  rightEdge,
}: {
  leftEye: Point;
  rightEye: Point;
  forehead: Point;
  chin: Point;
  leftEdge: Point;
  rightEdge: Point;
}) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  landmarks[33] = { x: leftEye[0], y: leftEye[1] };
  landmarks[263] = { x: rightEye[0], y: rightEye[1] };
  landmarks[10] = { x: forehead[0], y: forehead[1] };
  landmarks[152] = { x: chin[0], y: chin[1] };
  landmarks[234] = { x: leftEdge[0], y: leftEdge[1] };
  landmarks[454] = { x: rightEdge[0], y: rightEdge[1] };
  return landmarks;
}

describe("face pose", () => {
  it("derives a centered width and eye-line rotation from face landmarks", () => {
    const pose = facePoseFromLandmarks(makeLandmarks({
      leftEye: [0.3, 0.4],
      rightEye: [0.7, 0.5],
      forehead: [0.5, 0.2],
      chin: [0.5, 0.8],
      leftEdge: [0.2, 0.5],
      rightEdge: [0.8, 0.5],
    }));

    expect(pose).toMatchObject({ centerX: 0.5, centerY: 0.5 });
    expect(pose?.width).toBeCloseTo(0.6, 5);
    expect(pose?.rotationDeg).toBeCloseTo(14.04, 1);
  });

  it("mirrors the pose into the front-camera display coordinate system", () => {
    expect(mirrorPose({ centerX: 0.25, centerY: 0.2, width: 0.6, rotationDeg: 12 }))
      .toEqual({ centerX: 0.75, centerY: 0.2, width: 0.6, rotationDeg: -12 });
  });

  it("smooths abrupt movement without changing the first pose", () => {
    const first = { centerX: 0.2, centerY: 0.2, width: 0.4, rotationDeg: 0 };
    const next = { centerX: 0.8, centerY: 0.6, width: 0.8, rotationDeg: 20 };

    expect(smoothFacePose(null, first)).toBe(first);
    const smoothed = smoothFacePose(first, next, 0.5);
    expect(smoothed).toMatchObject({
      centerX: 0.5,
      centerY: 0.4,
      rotationDeg: 10,
    });
    expect(smoothed.width).toBeCloseTo(0.6, 5);
  });

  it("responds quickly to a large face movement while damping small jitter", () => {
    const previous = { centerX: 0.2, centerY: 0.3, width: 0.4, rotationDeg: 0 };
    const largeMove = smoothFacePose(previous, {
      centerX: 0.8, centerY: 0.6, width: 0.5, rotationDeg: 18,
    });
    const smallJitter = smoothFacePose(previous, {
      centerX: 0.204, centerY: 0.303, width: 0.401, rotationDeg: 0.4,
    });

    expect(largeMove.centerX).toBeGreaterThan(0.6);
    expect(smallJitter.centerX).toBeLessThan(0.202);
  });

  it("rejects an incomplete or non-finite landmark set", () => {
    expect(facePoseFromLandmarks([])).toBeNull();
    const landmarks = makeLandmarks({
      leftEye: [Number.NaN, 0.4],
      rightEye: [0.7, 0.5],
      forehead: [0.5, 0.2],
      chin: [0.5, 0.8],
      leftEdge: [0.2, 0.5],
      rightEdge: [0.8, 0.5],
    });
    expect(facePoseFromLandmarks(landmarks)).toBeNull();
  });
});
