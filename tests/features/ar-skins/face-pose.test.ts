import { describe, expect, it } from "vitest";

import {
  facePoseFromLandmarks,
  mapFacePoseToCover,
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

    expect(pose).toMatchObject({
      centerX: 0.5,
      centerY: 0.5,
      eyeCenterX: 0.5,
      eyeCenterY: 0.45,
      foreheadX: 0.5,
      foreheadY: 0.2,
    });
    expect(pose?.width).toBeCloseTo(0.6, 5);
    expect(pose?.height).toBeCloseTo(0.6, 5);
    expect(pose?.rotationDeg).toBeCloseTo(14.04, 1);
  });

  it("mirrors the pose into the front-camera display coordinate system", () => {
    expect(mirrorPose({
      centerX: 0.25, centerY: 0.2, width: 0.6, height: 0.5,
      eyeCenterX: 0.3, eyeCenterY: 0.18, foreheadX: 0.28, foreheadY: 0.05,
      rotationDeg: 12,
    })).toEqual({
      centerX: 0.75, centerY: 0.2, width: 0.6, height: 0.5,
      eyeCenterX: 0.7, eyeCenterY: 0.18, foreheadX: 0.72, foreheadY: 0.05,
      rotationDeg: -12,
    });
  });

  it("smooths abrupt movement without changing the first pose", () => {
    const first = {
      centerX: 0.2, centerY: 0.2, width: 0.4, height: 0.5,
      eyeCenterX: 0.2, eyeCenterY: 0.18, foreheadX: 0.2, foreheadY: 0.05,
      rotationDeg: 0,
    };
    const next = {
      centerX: 0.8, centerY: 0.6, width: 0.8, height: 0.9,
      eyeCenterX: 0.8, eyeCenterY: 0.5, foreheadX: 0.8, foreheadY: 0.25,
      rotationDeg: 20,
    };

    expect(smoothFacePose(null, first)).toBe(first);
    const smoothed = smoothFacePose(first, next, 0.5);
    expect(smoothed).toMatchObject({
      centerX: 0.5,
      centerY: 0.4,
      eyeCenterX: 0.5,
      foreheadX: 0.5,
      rotationDeg: 10,
    });
    expect(smoothed.width).toBeCloseTo(0.6, 5);
    expect(smoothed.height).toBeCloseTo(0.7, 5);
    expect(smoothed.eyeCenterY).toBeCloseTo(0.34, 5);
    expect(smoothed.foreheadY).toBeCloseTo(0.15, 5);
  });

  it("responds quickly to a large face movement while damping small jitter", () => {
    const previous = {
      centerX: 0.2, centerY: 0.3, width: 0.4, height: 0.5,
      eyeCenterX: 0.2, eyeCenterY: 0.25, foreheadX: 0.2, foreheadY: 0.08,
      rotationDeg: 0,
    };
    const largeMove = smoothFacePose(previous, {
      centerX: 0.8, centerY: 0.6, width: 0.5, height: 0.6,
      eyeCenterX: 0.8, eyeCenterY: 0.5, foreheadX: 0.8, foreheadY: 0.2,
      rotationDeg: 18,
    });
    const smallJitter = smoothFacePose(previous, {
      centerX: 0.204, centerY: 0.303, width: 0.401, height: 0.501,
      eyeCenterX: 0.204, eyeCenterY: 0.253, foreheadX: 0.204, foreheadY: 0.081,
      rotationDeg: 0.4,
    });

    expect(largeMove.centerX).toBeGreaterThan(0.6);
    expect(smallJitter.centerX).toBeLessThan(0.202);
  });

  it("maps face size and landmark anchors through cover cropping", () => {
    const mapped = mapFacePoseToCover({
      centerX: 0.4, centerY: 0.5, width: 0.2, height: 0.4,
      eyeCenterX: 0.42, eyeCenterY: 0.4, foreheadX: 0.4, foreheadY: 0.2,
      rotationDeg: 0,
    }, { width: 320, height: 568 }, { width: 640, height: 480 });

    expect(mapped.centerX).toBeCloseTo(0.2633, 3);
    expect(mapped.width).toBeCloseTo(0.4733, 3);
    expect(mapped.height).toBeCloseTo(0.4, 3);
    expect(mapped.eyeCenterX).toBeCloseTo(0.3107, 3);
    expect(mapped.eyeCenterY).toBeCloseTo(0.4, 3);
    expect(mapped.foreheadX).toBeCloseTo(0.2633, 3);
    expect(mapped.foreheadY).toBeCloseTo(0.2, 3);
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
