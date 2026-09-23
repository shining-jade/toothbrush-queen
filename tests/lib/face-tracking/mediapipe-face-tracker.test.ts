import { describe, expect, it, vi } from "vitest";

import { createMediaPipeFaceTracker } from "@/lib/face-tracking/mediapipe-face-tracker";

function fakeVideo({
  readyState = 4,
  videoWidth = 640,
  videoHeight = 480,
} = {}) {
  return { readyState, videoWidth, videoHeight } as HTMLVideoElement;
}

function validLandmarks() {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[33] = { x: 0.3, y: 0.4 };
  landmarks[263] = { x: 0.7, y: 0.4 };
  landmarks[10] = { x: 0.5, y: 0.2 };
  landmarks[234] = { x: 0.2, y: 0.5 };
  landmarks[454] = { x: 0.8, y: 0.5 };
  return landmarks;
}

function harness() {
  let scheduled: FrameRequestCallback | null = null;
  let currentTime = 0;
  let frameId = 0;
  const detectForVideo = vi.fn(() => ({ faceLandmarks: [validLandmarks()] }));
  const close = vi.fn();
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    scheduled = callback;
    frameId += 1;
    return frameId;
  });
  const cancelFrame = vi.fn();
  const createLandmarker = vi.fn(async () => ({ detectForVideo, close }));
  const tracker = createMediaPipeFaceTracker({
    createLandmarker,
    requestFrame,
    cancelFrame,
    now: () => currentTime,
  });
  return {
    tracker,
    createLandmarker,
    detectForVideo,
    close,
    requestFrame,
    cancelFrame,
    runFrame(time: number) {
      currentTime = time;
      const callback = scheduled;
      scheduled = null;
      if (!callback) throw new Error("NO_FRAME_SCHEDULED");
      callback(time);
    },
  };
}

describe("MediaPipe face tracker", () => {
  it("does not infer before the video has decoded dimensions", async () => {
    const test = harness();
    await test.tracker.start(
      fakeVideo({ readyState: 1, videoWidth: 0, videoHeight: 0 }),
      vi.fn(),
    );

    test.runFrame(100);

    expect(test.detectForVideo).not.toHaveBeenCalled();
  });

  it("runs no more than fifteen inferences per second", async () => {
    const test = harness();
    const onResult = vi.fn();
    await test.tracker.start(fakeVideo(), onResult);

    test.runFrame(0);
    test.runFrame(20);
    test.runFrame(67);
    test.runFrame(100);

    expect(test.detectForVideo).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult.mock.calls[0][0]).toMatchObject({ detected: true, nowMs: 0 });
  });

  it("cancels the scheduled frame and closes the landmarker", async () => {
    const test = harness();
    await test.tracker.start(fakeVideo(), vi.fn());

    test.tracker.stop();

    expect(test.cancelFrame).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
  });

  it("does not schedule a frame when model creation fails", async () => {
    const requestFrame = vi.fn();
    const tracker = createMediaPipeFaceTracker({
      createLandmarker: vi.fn().mockRejectedValue(new Error("model failed")),
      requestFrame,
    });

    await expect(tracker.start(fakeVideo(), vi.fn())).rejects.toThrow("model failed");
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
