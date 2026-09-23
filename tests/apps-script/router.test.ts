import { describe, expect, it } from "vitest";

import { createRouter } from "../../apps-script/src/router";

describe("Apps Script router", () => {
  const challenge = {
    challengeId: "ABC123", name: "5일 양치왕", startDate: "2026-09-20",
    endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul",
    durationMode: "choice" as const, dailyLimit: 1, status: "active" as const,
  };

  const router = createRouter({
    getChallenge: (challengeId) => challengeId === "ABC123" ? challenge : null,
    joinStudent: () => ({ deviceToken: "a".repeat(64), progress: {
      challengeId: "ABC123", studentId: "stu-1", displayName: "2학년 3반 12번 김○○",
      acceptedDays: 0, targetDays: 5, completedToday: false,
    } }),
    resumeStudent: () => ({ status: "unauthenticated" }),
    getProgress: () => { throw new Error("UNAUTHENTICATED"); },
    startBrushing: () => ({
      attemptId: "attempt-1", attemptToken: "signed-attempt-token-value",
      durationSec: 60, issuedAtMs: 1_000,
    }),
    submitCompletion: () => ({
      completionId: "completion-1", challengeId: "ABC123", participationDate: "2026-09-23",
      acceptedDays: 1, targetDays: 5, newlyAccepted: true,
    }),
  });

  it("returns only public challenge fields", () => {
    expect(router({ action: "challenge.get", payload: { challengeId: "ABC123" } })).toEqual({
      ok: true,
      data: challenge,
    });
  });

  it("uses a constant safe error envelope without request data", () => {
    const response = router({
      action: "progress.get",
      auth: { deviceToken: "secret-device-token-value" },
      payload: { challengeId: "ABC123" },
    });
    expect(response).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "인증이 필요합니다." },
    });
    expect(JSON.stringify(response)).not.toContain("secret-device-token-value");
  });

  it("rejects unknown actions", () => {
    expect(router({ action: "unknown.action", payload: {} })).toEqual({
      ok: false,
      error: { code: "ACTION_NOT_FOUND", message: "요청을 처리할 수 없습니다." },
    });
  });

  it("routes authenticated brushing start and completion", () => {
    expect(router({
      action: "brushing.start", auth: { deviceToken: "secret-device-token-value" },
      payload: { challengeId: "ABC123", selectedDurationSec: 60 },
    })).toMatchObject({ ok: true, data: { attemptId: "attempt-1" } });
    expect(router({
      action: "completion.submit", auth: { deviceToken: "secret-device-token-value" },
      payload: {
        challengeId: "ABC123", attemptToken: "signed-attempt-token-value",
        idempotencyKey: "97ab5a61-26eb-45fd-8fa2-5dc01fb1f5d6", elapsedSec: 60,
        faceDetectedSec: null, cameraMode: "timer-only",
      },
    })).toMatchObject({ ok: true, data: { completionId: "completion-1" } });
  });
});
