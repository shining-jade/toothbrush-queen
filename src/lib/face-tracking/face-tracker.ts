import type { FacePose } from "@/features/ar-skins/face-pose";

export type FaceTrackingResult = {
  pose: FacePose | null;
  detected: boolean;
  nowMs: number;
};

export type FaceTracker = {
  start: (
    video: HTMLVideoElement,
    onResult: (result: FaceTrackingResult) => void,
    onError?: (error: unknown) => void,
  ) => Promise<void>;
  stop: () => void;
};
