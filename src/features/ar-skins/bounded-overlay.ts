import type { CSSProperties } from "react";

import type { SkinCalibration } from "@/features/admin/skin-upload/skin-calibration";

import type { FacePose } from "./face-pose";
import type { SkinPlacement } from "./skin-registry";

export type PixelSize = { width: number; height: number };
const WEARABLE_SCALE_BOOST = 1.2;

function px(value: number) {
  return `${Number(value.toFixed(4))}px`;
}

export function boundedOverlayStyle(
  pose: FacePose,
  calibration: SkinCalibration,
  stageSize: PixelSize,
  imageSize: PixelSize,
  insetPx = 8,
  placement?: SkinPlacement,
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
  let width = pose.width * calibration.scale * WEARABLE_SCALE_BOOST * stageSize.width;
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

  const baseX = placement === "eyes"
    ? pose.eyeCenterX
    : placement === "forehead" ? pose.foreheadX : pose.centerX;
  const baseY = placement === "eyes"
    ? pose.eyeCenterY
    : placement === "forehead" ? pose.foreheadY : pose.centerY;
  const verticalScale = placement ? pose.height : pose.width;
  if (
    baseX === undefined || baseY === undefined || verticalScale === undefined
    || ![baseX, baseY, verticalScale].every(Number.isFinite) || verticalScale <= 0
  ) return null;

  const requestedX = (baseX + pose.width * calibration.anchorX) * stageSize.width;
  const requestedY = (baseY + verticalScale * calibration.anchorY) * stageSize.height;

  return {
    left: px(requestedX),
    top: px(requestedY),
    width: px(width),
    transform: `translate3d(-50%, -50%, 0) rotate(${rotationDeg}deg)`,
    visibility: "visible",
  };
}
