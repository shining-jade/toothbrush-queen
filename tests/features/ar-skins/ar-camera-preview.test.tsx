import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArCameraPreview } from "@/features/ar-skins/ar-camera-preview";
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

describe("ArCameraPreview", () => {
  it("shows face guidance and keeps the camera after tracking fails", async () => {
    const { tracker, emit, fail } = fixture();
    const onTime = vi.fn();
    render(
      <ArCameraPreview
        stream={{} as MediaStream}
        skinId="cat"
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
        skinId="rabbit"
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

    const overlay = screen.getByTestId("ar-skin-overlay");
    expect(overlay).toHaveStyle({ left: "60%", top: "16.25%", width: "37.5%" });
    expect(overlay.getAttribute("style")).toContain("rotate(-8deg)");
    unmount();
    expect(tracker.stop).toHaveBeenCalled();
  });
});
