import type { FacePose } from "@/features/ar-skins/face-pose";

export type PixelFrame = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ToothbrushLikeDetector = {
  observe: (video: HTMLVideoElement, facePose: FacePose, nowMs: number) => boolean;
  reset: () => void;
};

type FrameReader = (video: HTMLVideoElement, facePose: FacePose) => PixelFrame | null;

export function isToothbrushLikeChange(baseline: PixelFrame, current: PixelFrame) {
  if (
    baseline.width !== current.width || baseline.height !== current.height
    || baseline.data.length !== current.data.length
    || baseline.width <= 0 || baseline.height <= 0
  ) return false;

  let changed = 0;
  let minimumX = current.width;
  let maximumX = -1;
  let minimumY = current.height;
  let maximumY = -1;

  for (let pixel = 0; pixel < current.width * current.height; pixel += 1) {
    const offset = pixel * 4;
    const difference = Math.max(
      Math.abs(current.data[offset] - baseline.data[offset]),
      Math.abs(current.data[offset + 1] - baseline.data[offset + 1]),
      Math.abs(current.data[offset + 2] - baseline.data[offset + 2]),
    );
    if (difference < 45) continue;
    changed += 1;
    const x = pixel % current.width;
    const y = Math.floor(pixel / current.width);
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }

  const totalPixels = current.width * current.height;
  const changedRatio = changed / totalPixels;
  if (changedRatio < 0.005 || changedRatio > 0.3 || maximumX < minimumX || maximumY < minimumY) {
    return false;
  }

  const changedWidth = maximumX - minimumX + 1;
  const changedHeight = maximumY - minimumY + 1;
  const longSide = Math.max(changedWidth, changedHeight);
  const shortSide = Math.max(1, Math.min(changedWidth, changedHeight));
  return longSide / shortSide >= 2.2
    && longSide >= Math.min(current.width, current.height) * 0.2;
}

function createBrowserFrameReader(): FrameReader {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  return (video, facePose) => {
    if (!context || video.videoWidth <= 0 || video.videoHeight <= 0) return null;
    const regionWidth = Math.min(1, facePose.width * 1.5);
    const regionHeight = Math.min(1, facePose.width * 0.8);
    const centerX = facePose.centerX;
    const centerY = facePose.centerY + facePose.width * 0.58;
    const left = Math.max(0, Math.min(1 - regionWidth, centerX - regionWidth / 2));
    const top = Math.max(0, Math.min(1 - regionHeight, centerY - regionHeight / 2));
    try {
      context.drawImage(
        video,
        left * video.videoWidth,
        top * video.videoHeight,
        regionWidth * video.videoWidth,
        regionHeight * video.videoHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return { width: image.width, height: image.height, data: image.data };
    } catch {
      return null;
    }
  };
}

export function createToothbrushLikeDetector({
  readFrame = createBrowserFrameReader(),
  holdMs = 800,
}: {
  readFrame?: FrameReader;
  holdMs?: number;
} = {}): ToothbrushLikeDetector {
  let baseline: PixelFrame | null = null;
  let candidateStartedAtMs: number | null = null;

  const reset = () => {
    baseline = null;
    candidateStartedAtMs = null;
  };

  return {
    observe(video, facePose, nowMs) {
      const current = readFrame(video, facePose);
      if (!current) return false;
      if (!baseline || baseline.width !== current.width || baseline.height !== current.height) {
        baseline = current;
        candidateStartedAtMs = null;
        return false;
      }
      if (!isToothbrushLikeChange(baseline, current)) {
        baseline = current;
        candidateStartedAtMs = null;
        return false;
      }
      if (candidateStartedAtMs === null) {
        candidateStartedAtMs = nowMs;
        return false;
      }
      if (nowMs - candidateStartedAtMs < Math.max(0, holdMs)) return false;
      baseline = current;
      candidateStartedAtMs = null;
      return true;
    },
    reset,
  };
}

