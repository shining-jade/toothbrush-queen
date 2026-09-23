import { facePoseFromLandmarks } from "@/features/ar-skins/face-pose";

import type { FaceTracker } from "./face-tracker";

type LandmarkerResult = {
  faceLandmarks: Array<Array<{ x: number; y: number }>>;
};

type Landmarker = {
  detectForVideo: (video: HTMLVideoElement, nowMs: number) => LandmarkerResult;
  close: () => void;
};

type FaceTrackerDependencies = {
  createLandmarker?: () => Promise<Landmarker>;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  now?: () => number;
};

const WASM_PATH = "/mediapipe/wasm";
// SHA-256: 64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF
const MODEL_PATH = "/mediapipe/models/face_landmarker.task";
const MIN_INFERENCE_INTERVAL_MS = 66;

async function createBrowserLandmarker(): Promise<Landmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

export function createMediaPipeFaceTracker(
  dependencies: FaceTrackerDependencies = {},
): FaceTracker {
  const createLandmarker = dependencies.createLandmarker ?? createBrowserLandmarker;
  const requestFrame = dependencies.requestFrame ?? ((callback) => requestAnimationFrame(callback));
  const cancelFrame = dependencies.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  const now = dependencies.now ?? (() => performance.now());
  let landmarker: Landmarker | null = null;
  let frameId: number | null = null;
  let generation = 0;

  const stop = () => {
    generation += 1;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    landmarker?.close();
    landmarker = null;
  };

  return {
    async start(video, onResult, onError) {
      stop();
      const activeGeneration = generation;
      const created = await createLandmarker();
      if (generation !== activeGeneration) {
        created.close();
        return;
      }
      landmarker = created;
      let lastInferenceMs = Number.NEGATIVE_INFINITY;

      const loop = () => {
        if (!landmarker || generation !== activeGeneration) return;
        const nowMs = now();
        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          nowMs - lastInferenceMs >= MIN_INFERENCE_INTERVAL_MS
        ) {
          try {
            const result = landmarker.detectForVideo(video, nowMs);
            const pose = facePoseFromLandmarks(result.faceLandmarks[0] ?? []);
            lastInferenceMs = nowMs;
            onResult({ pose, detected: pose !== null, nowMs });
          } catch (error) {
            onError?.(error);
            stop();
            return;
          }
        }
        frameId = requestFrame(loop);
      };

      frameId = requestFrame(loop);
    },
    stop,
  };
}
