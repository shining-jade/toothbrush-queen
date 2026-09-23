import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrushingScreen,
  type BrushingScreenServices,
} from "@/features/brushing-session/brushing-screen";

function services(mode: "camera" | "timer-only" = "timer-only") {
  const track = { stop: vi.fn() };
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;
  const resultStream = mode === "camera" ? stream : null;
  const value: BrushingScreenServices = {
    camera: {
      start: vi.fn().mockResolvedValue({ mode, stream: resultStream }),
      stop: vi.fn(() => resultStream?.getTracks().forEach((item) => item.stop())),
    },
    api: {
      request: vi.fn().mockResolvedValue({
        attemptId: "attempt-1",
        attemptToken: "signed-attempt-token-1234567890",
        durationSec: 60,
        issuedAtMs: 1,
      }),
    },
    sessionStore: { get: vi.fn(() => "device-token-12345678901234567890") },
  };
  return { value, track };
}

afterEach(() => vi.useRealTimers());

describe("BrushingScreen", () => {
  it("requests permission only after the privacy notice is confirmed", async () => {
    const testServices = services();
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);

    fireEvent.click(screen.getByRole("button", { name: "60초" }));
    expect(
      screen.getByText(
        "카메라는 AR 스킨 표시와 챌린지 진행을 위해 사용됩니다. 카메라 영상과 얼굴 이미지는 저장되지 않습니다.",
      ),
    ).toBeVisible();
    expect(testServices.value.camera.start).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" }));
    });
    expect(testServices.value.camera.start).toHaveBeenCalledOnce();
  });

  it("runs without a video when camera permission is unavailable", async () => {
    const testServices = services("timer-only");
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    fireEvent.click(screen.getByRole("button", { name: "60초" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" }));
    });

    expect(screen.getByText("카메라 없이 타이머로 진행 중이에요.")).toBeVisible();
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
    expect(screen.queryByText(/다운로드/)).toBeNull();
  });

  it("keeps completion disabled until the timer reaches zero", async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const testServices = services();
    render(
      <BrushingScreen
        challengeId="ABC123"
        services={testServices.value}
        completionServices={{
          submitOrQueue: vi.fn(),
          retryPending: vi.fn(),
          loadPending: vi.fn(() => null),
          getDeviceToken: vi.fn(() => "device-token"),
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "60초" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" }));
    });

    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeDisabled();
    vi.spyOn(performance, "now").mockReturnValue(60_000);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "양치 완료 기록하기" }));
    expect(
      screen.getByRole("button", { name: "챌린지 완료하고 제출하기" }),
    ).toBeVisible();
  });

  it("stops the camera when leaving the screen", async () => {
    const testServices = services("camera");
    const { unmount } = render(
      <BrushingScreen challengeId="ABC123" services={testServices.value} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "60초" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" }));
    });

    unmount();
    expect(testServices.value.camera.stop).toHaveBeenCalledOnce();
    expect(testServices.track.stop).toHaveBeenCalledOnce();
  });
});
