import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrushingScreen, type BrushingScreenServices } from "@/features/brushing-session/brushing-screen";
import type { CompletionScreenServices } from "@/features/completion/completion-screen";
import type { FaceTrackingResult } from "@/lib/face-tracking/face-tracker";

const challenge = { challengeId: "ABC123", name: "5일 양치왕 챌린지", startDate: "2026-09-20", endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul", durationMode: "choice" as const, dailyLimit: 1, status: "active" as const };
const remoteSkin = { skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://example.com/flower.png", anchorX: 0, anchorY: -0.4, scale: 1.5, rotationOffset: 0, version: 1, sortOrder: 1 };
const progress = { challengeId: "ABC123", studentId: "student-1", displayName: "김학생", acceptedDays: 2, targetDays: 5, completedToday: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

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
    completionFeedback: {
      prime: vi.fn(),
      signal: vi.fn(),
      dispose: vi.fn(),
    },
    loadingHoldMs: 0,
  };
  return { value, tracker, emit: (result: FaceTrackingResult) => emitResult?.(result) };
}

async function reachPrivacyNotice(
  testServices: ReturnType<typeof services>,
  mode = "60초",
  completionServices?: CompletionScreenServices,
) {
  const view = render(<BrushingScreen challengeId="ABC123" services={testServices.value} completionServices={completionServices} />);
  fireEvent.click(await screen.findByRole("button", { name: mode }));
  expect(screen.getAllByRole("radio")).toHaveLength(15);
  fireEvent.click(screen.getByRole("button", { name: "이 스킨으로 시작하기" }));
  return view;
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("BrushingScreen", () => {
  it("shows real preflight progress through 100 percent before duration choices", async () => {
    vi.useFakeTimers();
    const testServices = services();
    testServices.value.loadingHoldMs = 220;
    const challengeRequest = deferred<typeof challenge>();
    const progressRequest = deferred<typeof progress>();
    vi.mocked(testServices.value.getChallenge).mockReturnValue(challengeRequest.promise);
    vi.mocked(testServices.value.getProgress).mockReturnValue(progressRequest.promise);

    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);

    await act(async () => undefined);
    expect(screen.getByRole("progressbar", { name: "진행 상황을 확인하고 있어요." })).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByRole("img", { name: "도장판의 도장을 세어 보는 학생" })).toHaveAttribute(
      "src",
      expect.stringContaining("brushing-queen-progress-check"),
    );

    await act(async () => challengeRequest.resolve(challenge));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "45");

    await act(async () => progressRequest.resolve(progress));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeVisible();

    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByRole("button", { name: "60초" })).toBeVisible();
  });

  it("shows camera and attempt loading stages through 100 percent", async () => {
    const testServices = services("camera");
    await reachPrivacyNotice(testServices);
    const cameraRequest = deferred<{ mode: "camera"; stream: MediaStream }>();
    const attemptRequest = deferred<{ attemptId: string; attemptToken: string; durationSec: 60; issuedAtMs: number }>();
    vi.mocked(testServices.value.camera.start).mockReturnValue(cameraRequest.promise);
    vi.mocked(testServices.value.api.request).mockReturnValue(attemptRequest.promise);
    testServices.value.loadingHoldMs = 220;
    vi.useFakeTimers();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    expect(screen.getByRole("progressbar", { name: "양치 도전을 준비하고 있어요." })).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByRole("img", { name: "거울 앞에서 양치를 준비하는 학생" })).toHaveAttribute(
      "src",
      expect.stringContaining("brushing-queen-ready"),
    );

    await act(async () => cameraRequest.resolve({ mode: "camera", stream: {} as MediaStream }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "55");

    await act(async () => attemptRequest.resolve({
      attemptId: "attempt-1",
      attemptToken: "signed-attempt-token-1234567890",
      durationSec: 60,
      issuedAtMs: 1,
    }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByLabelText("내 얼굴 카메라 미리보기")).toBeVisible();
  });

  it("loads progress before exposing camera permission and offers the bundled skin collection", async () => {
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

  it("lets the student start immediately while waiting for a face", async () => {
    const testServices = services("camera");
    await reachPrivacyNotice(testServices);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));

    expect(screen.getByRole("button", { name: "바로 시작하기" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "양치 완료 기록하기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "바로 시작하기" }));
    expect(screen.getByText("01:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();
  });

  it("starts brushing as soon as a face is detected", async () => {
    const testServices = services("camera");
    await reachPrivacyNotice(testServices);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    act(() => testServices.emit({
      detected: true,
      pose: { centerX: 0.5, centerY: 0.3, width: 0.2, rotationDeg: 0 },
      nowMs: 100,
    }));

    expect(screen.queryByRole("button", { name: "바로 시작하기" })).toBeNull();
    expect(screen.getByText("01:00")).toBeVisible();
  });

  it("lets the student shrink and drag the timer on different phone sizes", async () => {
    const testServices = services();
    await reachPrivacyNotice(testServices);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));

    const timer = screen.getByLabelText("양치 초시계");
    expect(timer).toHaveAttribute("data-size", "normal");
    fireEvent.click(screen.getByRole("button", { name: "초시계 작게 보기" }));
    expect(timer).toHaveAttribute("data-size", "compact");

    const stage = timer.closest(".brushing-stage");
    expect(stage).not.toBeNull();
    vi.spyOn(stage as HTMLElement, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 360,
      width: 320, height: 360, toJSON: () => ({}),
    });
    fireEvent.pointerDown(timer, { clientX: 280, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(timer, { clientX: 80, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(timer, { clientX: 80, clientY: 180, pointerId: 1 });
    expect(timer).toHaveStyle({ left: "25%", top: "50%" });
  });

  it("stops a camera stream that arrives after the screen unmounts", async () => {
    const testServices = services("camera");
    const cameraRequest = deferred<{ mode: "camera"; stream: MediaStream }>();
    const attemptRequest = deferred<{ attemptId: string; attemptToken: string; durationSec: 60; issuedAtMs: number }>();
    vi.mocked(testServices.value.camera.start).mockReturnValue(cameraRequest.promise);
    vi.mocked(testServices.value.api.request).mockReturnValue(attemptRequest.promise);
    const view = await reachPrivacyNotice(testServices);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    view.unmount();
    await act(async () => {
      cameraRequest.resolve({ mode: "camera", stream: {} as MediaStream });
      attemptRequest.resolve({
        attemptId: "attempt-1",
        attemptToken: "signed-attempt-token-1234567890",
        durationSec: 60,
        issuedAtMs: 1,
      });
    });

    expect(testServices.value.camera.stop).toHaveBeenCalledTimes(2);
  });

  it("allows completion immediately while free brushing time keeps counting", async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const testServices = services();
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "자유 양치" }));
    fireEvent.click(screen.getByRole("button", { name: "이 스킨으로 시작하기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    expect(screen.getByText("00:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();
    vi.spyOn(performance, "now").mockReturnValue(60_000);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("01:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "양치 완료 기록하기" })).toBeEnabled();
  });

  it("opens the completion screen when a fixed timer is stopped early", async () => {
    const testServices = services();
    await reachPrivacyNotice(testServices, "60초", {
      submitOrQueue: vi.fn(),
      retryPending: vi.fn(),
      loadPending: vi.fn(() => null),
      getDeviceToken: vi.fn(() => "device-token"),
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));

    fireEvent.click(screen.getByRole("button", { name: "양치 완료 기록하기" }));

    expect(screen.getByRole("heading", { name: "양치 기록 보내기" })).toBeVisible();
    expect(screen.getByText("총 0분 0초 동안 양치했어요.")).toBeVisible();
    expect(testServices.value.camera.stop).toHaveBeenCalled();
    expect(testServices.value.completionFeedback.signal).not.toHaveBeenCalled();
  });

  it("signals once and shows a celebration when a fixed timer reaches zero", async () => {
    const testServices = services();
    render(<BrushingScreen challengeId="ABC123" services={testServices.value} />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "60초" }));
    fireEvent.click(screen.getByRole("button", { name: "이 스킨으로 시작하기" }));
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인하고 시작하기" })));
    expect(testServices.value.completionFeedback.prime).toHaveBeenCalledOnce();

    vi.spyOn(performance, "now").mockReturnValue(60_000);
    act(() => vi.advanceTimersByTime(60_000));

    expect(screen.getByRole("status", { name: "양치 시간 완료 알림" })).toBeVisible();
    expect(testServices.value.completionFeedback.signal).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(1_000));
    expect(testServices.value.completionFeedback.signal).toHaveBeenCalledOnce();
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
    fireEvent.click(screen.getByRole("button", { name: "바로 시작하기" }));
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
