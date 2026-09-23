import type { CSSProperties } from "react";

import type { FacePose } from "@/features/ar-skins/face-pose";

export type SkinCalibration = {
  anchorX: number;
  anchorY: number;
  scale: number;
  rotationOffset: number;
};

export const DEFAULT_CALIBRATION: SkinCalibration = {
  anchorX: 0,
  anchorY: -0.4,
  scale: 1.4,
  rotationOffset: 0,
};

function percent(value: number) {
  return `${Number((value * 100).toFixed(4))}%`;
}

export function skinOverlayStyle(
  pose: FacePose,
  calibration: SkinCalibration,
): CSSProperties {
  return {
    left: percent(pose.centerX + pose.width * calibration.anchorX),
    top: percent(pose.centerY + pose.width * calibration.anchorY),
    width: percent(pose.width * calibration.scale),
    transform: `translate(-50%, -50%) rotate(${pose.rotationDeg + calibration.rotationOffset}deg)`,
  };
}
