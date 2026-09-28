export type FaceLandmarkPoint = { x: number; y: number };

export type FacePose = {
  centerX: number;
  centerY: number;
  width: number;
  height?: number;
  eyeCenterX?: number;
  eyeCenterY?: number;
  foreheadX?: number;
  foreheadY?: number;
  rotationDeg: number;
};

const REQUIRED_INDICES = [33, 263, 10, 152, 234, 454] as const;

export function facePoseFromLandmarks(
  landmarks: FaceLandmarkPoint[],
): FacePose | null {
  const points = REQUIRED_INDICES.map((index) => landmarks[index]);
  if (points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return null;
  }

  const [leftEye, rightEye, forehead, chin, leftEdge, rightEdge] = points as [
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
    FaceLandmarkPoint,
  ];
  const width = Math.hypot(rightEdge.x - leftEdge.x, rightEdge.y - leftEdge.y);
  const height = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  if (width <= 0 || height <= 0) return null;

  return {
    centerX: (leftEdge.x + rightEdge.x) / 2,
    centerY: (forehead.y + chin.y) / 2,
    width,
    height,
    eyeCenterX: (leftEye.x + rightEye.x) / 2,
    eyeCenterY: (leftEye.y + rightEye.y) / 2,
    foreheadX: forehead.x,
    foreheadY: forehead.y,
    rotationDeg: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI,
  };
}

export function mirrorPose(pose: FacePose): FacePose {
  return {
    ...pose,
    centerX: 1 - pose.centerX,
    eyeCenterX: pose.eyeCenterX === undefined ? undefined : 1 - pose.eyeCenterX,
    foreheadX: pose.foreheadX === undefined ? undefined : 1 - pose.foreheadX,
    rotationDeg: -pose.rotationDeg,
  };
}

export function smoothFacePose(
  previous: FacePose | null,
  next: FacePose,
  alpha?: number,
): FacePose {
  if (!previous) return next;
  const faceWidth = Math.max(next.width, 0.01);
  const movement = Math.hypot(
    next.centerX - previous.centerX,
    next.centerY - previous.centerY,
  ) / faceWidth;
  const scaleChange = Math.abs(next.width - previous.width) / faceWidth;
  const rotationChange = Math.abs(next.rotationDeg - previous.rotationDeg) / 45;
  const adaptiveAlpha = Math.min(0.85, Math.max(
    0.25,
    0.25 + Math.max(movement, scaleChange, rotationChange) * 0.75,
  ));
  const blend = alpha ?? adaptiveAlpha;
  const mix = (from: number, to: number) => from + (to - from) * blend;
  const mixOptional = (from: number | undefined, to: number | undefined) => {
    if (from === undefined) return to;
    if (to === undefined) return from;
    return mix(from, to);
  };
  return {
    centerX: mix(previous.centerX, next.centerX),
    centerY: mix(previous.centerY, next.centerY),
    width: mix(previous.width, next.width),
    height: mixOptional(previous.height, next.height),
    eyeCenterX: mixOptional(previous.eyeCenterX, next.eyeCenterX),
    eyeCenterY: mixOptional(previous.eyeCenterY, next.eyeCenterY),
    foreheadX: mixOptional(previous.foreheadX, next.foreheadX),
    foreheadY: mixOptional(previous.foreheadY, next.foreheadY),
    rotationDeg: mix(previous.rotationDeg, next.rotationDeg),
  };
}

export function mapFacePoseToCover(
  pose: FacePose,
  stageSize: { width: number; height: number },
  videoSize: { width: number; height: number },
): FacePose {
  if (
    stageSize.width <= 0 || stageSize.height <= 0
    || videoSize.width <= 0 || videoSize.height <= 0
  ) return pose;

  const coverScale = Math.max(
    stageSize.width / videoSize.width,
    stageSize.height / videoSize.height,
  );
  const displayedWidth = videoSize.width * coverScale;
  const displayedHeight = videoSize.height * coverScale;
  const cropX = (displayedWidth - stageSize.width) / 2;
  const cropY = (displayedHeight - stageSize.height) / 2;
  const mapX = (value: number) => (value * displayedWidth - cropX) / stageSize.width;
  const mapY = (value: number) => (value * displayedHeight - cropY) / stageSize.height;

  return {
    centerX: mapX(pose.centerX),
    centerY: mapY(pose.centerY),
    width: pose.width * displayedWidth / stageSize.width,
    height: pose.height === undefined ? undefined : pose.height * displayedHeight / stageSize.height,
    eyeCenterX: pose.eyeCenterX === undefined ? undefined : mapX(pose.eyeCenterX),
    eyeCenterY: pose.eyeCenterY === undefined ? undefined : mapY(pose.eyeCenterY),
    foreheadX: pose.foreheadX === undefined ? undefined : mapX(pose.foreheadX),
    foreheadY: pose.foreheadY === undefined ? undefined : mapY(pose.foreheadY),
    rotationDeg: pose.rotationDeg,
  };
}
