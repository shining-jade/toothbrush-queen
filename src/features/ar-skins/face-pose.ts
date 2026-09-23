export type FaceLandmarkPoint = { x: number; y: number };

export type FacePose = {
  centerX: number;
  centerY: number;
  width: number;
  rotationDeg: number;
};

const REQUIRED_INDICES = [33, 263, 10, 234, 454] as const;

export function facePoseFromLandmarks(
  landmarks: FaceLandmarkPoint[],
): FacePose | null {
  const points = REQUIRED_INDICES.map((index) => landmarks[index]);
  if (points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return null;
  }

  const [leftEye, rightEye, forehead, leftEdge, rightEdge] = points as [
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
  ];
  const width = Math.hypot(rightEdge.x - leftEdge.x, rightEdge.y - leftEdge.y);
  if (width <= 0) return null;

  return {
    centerX: (leftEdge.x + rightEdge.x) / 2,
    centerY: forehead.y,
    width,
    rotationDeg: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI,
  };
}

export function mirrorPose(pose: FacePose): FacePose {
  return {
    ...pose,
    centerX: 1 - pose.centerX,
    rotationDeg: -pose.rotationDeg,
  };
}

export function smoothFacePose(
  previous: FacePose | null,
  next: FacePose,
  alpha = 0.35,
): FacePose {
  if (!previous) return next;
  const mix = (from: number, to: number) => from + (to - from) * alpha;
  return {
    centerX: mix(previous.centerX, next.centerX),
    centerY: mix(previous.centerY, next.centerY),
    width: mix(previous.width, next.width),
    rotationDeg: mix(previous.rotationDeg, next.rotationDeg),
  };
}
