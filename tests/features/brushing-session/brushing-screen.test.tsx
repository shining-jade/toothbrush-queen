import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrushingScreen, type BrushingScreenServices } from "@/features/brushing-session/brushing-screen";
import type { FaceTrackingResult } from "@/lib/face-tracking/face-tracker";

const challenge = { challengeId: "ABC123", name: "5일 양치왕 챌린지", startDate: "2026-09-20", endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul", durationMode: "choice" as const, dailyLimit: 1, status: "active" as const };
const remoteSkin = { skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://example.com/flower.png", anchorX: 0, anchorY: -0.4, scale: 1.5, rotationOffset: 0, version: 1, sortOrder: 1 };
const progress = { challengeId: "ABC123", studentId: "student-1", displayName: "김학생", acceptedDays: 2, targetDays: 5, completedToday: false };

function services(mode: "camera" | "timer-only" = "timer-only") {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const resultStream = mode === "camera" ? stream : null;
  let emitResult: ((result: FaceTrackingResult) => void) | undefined;
  const tracker = {
    start: vi.fn(async (_video, onResult: (result: FaceTrackingResult) => void) => { emitResult = onResult; }),
    stop: vi.fn(),
  };
  const value: BrushingScreenServices = {
    camera: { start: vi.fn().mockResolvedValue({ mode, stream: resultStream }), stop: vi.fn(() => resultStream?.getTracks().forEach((item) => item.stop())) },
    api: { request: vi.fn().mockImplementation((_action, payload) => Promise.resolve({ attemptId: "attempt-1", attemptToken: "signed-attempt-token-1234567890", durationSec: (payload as { selectedDurationSec: 60 | 180 | "free" }).selectedDurationSec, issuedAtMs: 1 })) },
    sessionStore: { get: vi.fn(() => "device-token-12345678901234567890") },
    getChallenge: vi.fn().mockResolvedValue(challenge),
    getProgress: vi.fn().mockResolvedValue(progress),
    createFaceTracker: vi.fn(() => tracker),
  };
  return { value, tracker, emit: (result: FaceTrackingResult) => emitResult?.(result) };
}

async function reachPrivacyNotice(testServices: ReturnType<typeof services>, mode = "60초") {
  render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
  fireEvent.click(await screen.findByRole("button", { name: mode }));
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "이 스킨으로 시작하기" }));
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("BrushingScreen", () => {
  it("loads progress before exposing camera permission and offers three skins", async () => {
    const testServices = services();
    await reachPrivacyNotice(testServices);
    expect(screen.getByText("카메라 사용 안내")).toBeVisible();
    expect(testServices.value.camera.start).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    expect(testServices.value.camera.start).toHaveBeenCalledOnce();
  });

  it("offers an active uploaded skin from the challenge", async () => {
    const testServices = services();
    vi.mocked(testServices.value.getChallenge).mockResolvedValue({ ...challenge, skins: [remoteSkin] });
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    fireEvent.click(await screen.findByRole("button", { name: "60초" }));
    expect(screen.getByRole("radio", { name: "꽃님 사진관" })).toBeVisible();
  });

  it("retries failed preflight without opening the camera", async () => {
    const testServices = services();
    vi.mocked(testServices.value.getProgress).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(progress);
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("진행 상황을 불러오지 못했어요.");
    expect(testServices.value.camera.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("button", { name: "60초" })).toBeVisible();
  });

  it("automatically applies the crown on the final day", async () => {
    const testServices = services();
    vi.mocked(testServices.value.getProgress).mockResolvedValue({ ...progress, acceptedDays: 4 });
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    fireEvent.click(await screen.findByRole("button", { name: "60초" }));
    expect(screen.getByText("마지막 도전! 양치왕 왕관이 자동으로 적용돼요.")).toBeVisible();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("runs timer-only when camera permission is unavailable", async () => {
    const testServices = services();
    await reachPrivacyNotice(testServices);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    expect(screen.getByText("카메라 없이 타이머로 진행 중이에요.")).toBeVisible();
    expect(document.querySelector("video")).toBeNull();
  });

  it("counts free brushing from 00:00 and enables completion at 01:00", async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const testServices = services();
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "자유 양치" }));
    fireEvent.click(screen.getByRole("button", { name: "이 스킨으로 시작하기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    expect(screen.getByText("00:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeDisabled();
    vi.spyOn(performance, "now").mockReturnValue(60_000);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("01:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();
  });

  it("submits only aggregate face-detected seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const testServices = services("camera");
    const submitOrQueue = vi.fn().mockResolvedValue({ status: "pending" });
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} completionServices={{
      submitOrQueue,
      retryPending: vi.fn(),
      loadPending: vi.fn(() => null),
      getDeviceToken: vi.fn(() => "device-token"),
    }} />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "60초" }));
    fireEvent.click(screen.getByRole("button", { name: "이 스킨으로 시작하기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    vi.spyOn(performance, "now").mockReturnValue(60_000);
    act(() => vi.advanceTimersByTime(60_000));
    act(() => {
      testServices.emit({ detected: true, pose: { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 0 }, nowMs: 59_750 });
      testServices.emit({ detected: true, pose: { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 0 }, nowMs: 60_000 });
    });
    fireEvent.click(screen.getByRole("button", { name: "양치 완료 기록하기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "챌린지 완료하고 제출하기" })));
    expect(submitOrQueue).toHaveBeenCalledWith(expect.objectContaining({ faceDetectedSec: 0.25 }), "device-token");
  });
});
