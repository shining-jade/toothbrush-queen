import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArCameraPreview } from "@/features/ar-skins/ar-camera-preview";
import { AR_SKINS, mergeSkinCatalog } from "@/features/ar-skins/skin-registry";
import type { FaceTrackingResult, FaceTracker } from "@/lib/face-tracking/face-tracker";

function fixture() {
  let emitResult: ((result: FaceTrackingResult) => void) | undefined;
  let emitError: ((error: unknown) => void) | undefined;
  const tracker: FaceTracker = {
    start: vi.fn(async (_video, onResult, onError) => {
      emitResult = onResult;
      emitError = onError;
    }),
    stop: vi.fn(),
  };
  return {
    tracker,
    emit: (result: FaceTrackingResult) => emitResult?.(result),
    fail: (error: unknown) => emitError?.(error),
  };
}

let resizeStage: (() => void) | undefined;
let stageSize = { width: 320, height: 568 };

function loadOverlay(width = 600, height = 300) {
  const overlay = screen.getByTestId("ar-skin-overlay");
  Object.defineProperties(overlay, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  fireEvent.load(overlay);
  return overlay;
}

beforeEach(() => {
  stageSize = { width: 320, height: 568 };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    x: 0, y: 0, top: 0, left: 0, right: stageSize.width, bottom: stageSize.height,
    width: stageSize.width, height: stageSize.height, toJSON: () => ({}),
  }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resizeStage = callback; }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  resizeStage = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ArCameraPreview", () => {
  it("waits for a detected face and hides the skin as soon as the face is lost", async () => {
    const { tracker, emit } = fixture();
    render(
      <ArCameraPreview
        stream={{} as MediaStream}
        skin={AR_SKINS.cat}
        tracker={tracker}
        elapsedSec={0}
        onFaceDetectedSecChange={vi.fn()}
      />,
    );
    await act(async () => undefined);

    expect(screen.getByText("얼굴을 인식하고 있어요.")).toBeVisible();
    expect(screen.queryByTestId("ar-skin-overlay")).toBeNull();

    act(() => emit({
      detected: true,
      pose: { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 0 },
      nowMs: 100,
    }));
    expect(loadOverlay()).toBeVisible();

    act(() => emit({ detected: false, pose: null, nowMs: 200 }));
    expect(screen.queryByTestId("ar-skin-overlay")).toBeNull();
    expect(screen.getByText("얼굴이 화면에 보이도록 해주세요!")).toBeVisible();
  });

  it("shows face guidance and keeps the camera after tracking fails", async () => {
    const { tracker, emit, fail } = fixture();
    const onTime = vi.fn();
    render(
      <ArCameraPreview
        stream={{} as MediaStream}
        skin={AR_SKINS.cat}
        tracker={tracker}
        elapsedSec={10}
        onFaceDetectedSecChange={onTime}
      />,
    );
    await act(async () => undefined);

    act(() => emit({ detected: false, pose: null, nowMs: 100 }));
    expect(screen.getByText("얼굴이 화면에 보이도록 해주세요!")).toBeVisible();

    act(() => fail(new Error("model failed")));
    expect(screen.getByText("AR 효과 없이 계속 진행해요.")).toBeVisible();
    expect(screen.getByLabelText("내 얼굴 카메라 미리보기")).toBeVisible();
    expect(onTime).toHaveBeenLastCalledWith(null);
  });

  it("positions the selected skin from a detected face and stops on unmount", async () => {
    const { tracker, emit } = fixture();
    const { unmount } = render(
      <ArCameraPreview
        stream={{} as MediaStream}
        skin={AR_SKINS.rabbit}
        tracker={tracker}
        elapsedSec={2}
        onFaceDetectedSecChange={vi.fn()}
      />,
    );
    await act(async () => undefined);
    act(() => emit({
      detected: true,
      pose: { centerX: 0.4, centerY: 0.3, width: 0.25, rotationDeg: 8 },
      nowMs: 100,
    }));

    const overlay = loadOverlay();
    expect(overlay).toHaveStyle({ left: "192px", top: "156.2px", width: "144px" });
    expect(overlay.getAttribute("style")).toContain("rotate(-8deg)");
    unmount();
    expect(tracker.stop).toHaveBeenCalled();
  });

  it("uses uploaded calibration for a remote skin overlay", async () => {
    const { tracker, emit } = fixture();
    const remote = mergeSkinCatalog([{
      skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://example.com/flower.png",
      anchorX: 0.1, anchorY: -0.4, scale: 1.5, rotationOffset: 10, version: 1, sortOrder: 1,
    }]).find((skin) => skin.id === "skin-flower-1")!;
    render(<ArCameraPreview stream={{} as MediaStream} skin={remote} tracker={tracker} elapsedSec={1} onFaceDetectedSecChange={vi.fn()} />);
    await act(async () => undefined);
    act(() => emit({ detected: true, pose: { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 5 }, nowMs: 100 }));
    const overlay = loadOverlay();
    expect(overlay).toHaveStyle({ left: "166.4px", top: "124.96px", width: "115.2px" });
    expect(overlay.getAttribute("style")).toContain("rotate(5deg)");
  });

  it("maps face coordinates through a cropped landscape camera on a portrait phone", async () => {
    const { tracker, emit } = fixture();
    render(<ArCameraPreview stream={{} as MediaStream} skin={AR_SKINS.rabbit} tracker={tracker} elapsedSec={1} onFaceDetectedSecChange={vi.fn()} />);
    await act(async () => undefined);
    const video = screen.getByLabelText("내 얼굴 카메라 미리보기");
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 640 },
      videoHeight: { configurable: true, value: 480 },
    });

    act(() => emit({ detected: true, pose: { centerX: 0.5, centerY: 0.5, width: 0.2, rotationDeg: 0 }, nowMs: 100 }));
    const overlay = loadOverlay(1200, 1200);

    expect(overlay).toHaveStyle({ left: "160px", top: "257.115px", width: "272.64px" });
  });

  it("keeps the overlay hidden until measured and recomputes it after a mobile resize", async () => {
    const { tracker, emit } = fixture();
    render(<ArCameraPreview stream={{} as MediaStream} skin={AR_SKINS.cat} tracker={tracker} elapsedSec={1} onFaceDetectedSecChange={vi.fn()} />);
    await act(async () => undefined);
    act(() => emit({ detected: true, pose: { centerX: 0.15, centerY: 0.1, width: 0.8, rotationDeg: 0 }, nowMs: 100 }));

    const overlay = screen.getByTestId("ar-skin-overlay");
    expect(overlay).toHaveStyle({ visibility: "hidden" });
    loadOverlay();
    expect(overlay).toHaveStyle({ left: "272px", width: "436.224px", visibility: "visible" });

    stageSize = { width: 430, height: 932 };
    act(() => resizeStage?.());
    expect(overlay).toHaveStyle({ left: "365.5px", width: "586.176px" });
  });

  it("starts automatically when a face is detected without checking for a toothbrush", async () => {
    const { tracker, emit } = fixture();
    const onReady = vi.fn();
    render(
      <ArCameraPreview
        stream={{} as MediaStream}
        skin={AR_SKINS.cat}
        tracker={tracker}
        elapsedSec={0}
        onFaceDetectedSecChange={vi.fn()}
        preparing
        onReady={onReady}
      />,
    );
    await act(async () => undefined);
    expect(screen.getByText("얼굴을 화면에 맞추면 자동으로 시작해요.")).toBeVisible();

    act(() => emit({ detected: true, pose: { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 0 }, nowMs: 100 }));
    expect(onReady).toHaveBeenCalledOnce();

    act(() => emit({ detected: true, pose: { centerX: 0.5, centerY: 0.3, width: 0.3, rotationDeg: 0 }, nowMs: 900 }));
    expect(onReady).toHaveBeenCalledOnce();
  });
});
