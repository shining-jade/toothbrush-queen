import type { CSSProperties } from "react";

import type { SkinCalibration } from "@/features/admin/skin-upload/skin-calibration";

import type { FacePose } from "./face-pose";

export type PixelSize = { width: number; height: number };

function px(value: number) {
  return `${Number(value.toFixed(4))}px`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function boundedOverlayStyle(
  pose: FacePose,
  calibration: SkinCalibration,
  stageSize: PixelSize,
  imageSize: PixelSize,
  insetPx = 8,
): CSSProperties | null {
  const values = [
    pose.centerX, pose.centerY, pose.width, pose.rotationDeg,
    calibration.anchorX, calibration.anchorY, calibration.scale, calibration.rotationOffset,
    stageSize.width, stageSize.height, imageSize.width, imageSize.height, insetPx,
  ];
  if (values.some((value) => !Number.isFinite(value))) return null;
  if (
    pose.width <= 0 || calibration.scale <= 0
    || stageSize.width <= insetPx * 2 || stageSize.height <= insetPx * 2
    || imageSize.width <= 0 || imageSize.height <= 0
  ) return null;

  const aspectRatio = imageSize.width / imageSize.height;
  const rotationDeg = pose.rotationDeg + calibration.rotationOffset;
  const radians = Math.abs(rotationDeg) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  let width = pose.width * calibration.scale * stageSize.width;
  let height = width / aspectRatio;
  const rotatedWidth = cosine * width + sine * height;
  const rotatedHeight = sine * width + cosine * height;
  const fitScale = Math.min(
    1,
    stageSize.width * 1.8 / rotatedWidth,
    stageSize.height * 1.8 / rotatedHeight,
  );
  width *= fitScale;
  height *= fitScale;

  const requestedX = (pose.centerX + pose.width * calibration.anchorX) * stageSize.width;
  const requestedY = (pose.centerY + pose.width * calibration.anchorY) * stageSize.height;
  const centerX = clamp(
    requestedX,
    insetPx,
    stageSize.width - insetPx,
  );
  const centerY = clamp(
    requestedY,
    insetPx,
    stageSize.height - insetPx,
  );

  return {
    left: px(centerX),
    top: px(centerY),
    width: px(width),
    transform: `translate3d(-50%, -50%, 0) rotate(${rotationDeg}deg)`,
    visibility: "visible",
  };
}
