import type { Page, Route } from "@playwright/test";

export const APPS_SCRIPT_TEST_URL = "https://script.google.com/macros/s/test/exec";

const challenge = {
  challengeId: "ABC123",
  name: "5일 양치왕 챌린지",
  startDate: "2026-09-20",
  endDate: "2026-09-30",
  targetDays: 5,
  timeZone: "Asia/Seoul",
  durationMode: 60,
  dailyLimit: 1,
  status: "active",
};

type MockOptions = {
  acceptedDays?: number;
  durationMode?: 60 | 180 | "choice";
  loseFirstCompletionResponse?: boolean;
};

export async function mockAppsScript(page: Page, options: MockOptions = {}) {
  let acceptedDays = options.acceptedDays ?? 0;
  let completionRequests = 0;
  const completionPayloads: unknown[] = [];
  let hasStudent = false;

  const progress = () => ({
    challengeId: "ABC123",
    studentId: "student-1",
    displayName: "2학년 3반 12번 김○○",
    acceptedDays,
    targetDays: 5,
    completedToday: acceptedDays > (options.acceptedDays ?? 0),
  });

  const success = (route: Route, data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data }),
    });

  await page.route(APPS_SCRIPT_TEST_URL, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      action?: string;
      auth?: { deviceToken?: string };
      payload?: Record<string, unknown>;
    };

    if (body.action === "challenge.get") return success(route, {
      ...challenge,
      durationMode: options.durationMode ?? challenge.durationMode,
    });
    if (body.action === "student.join") {
      hasStudent = true;
      return success(route, {
        deviceToken: "device-token-12345678901234567890",
        progress: progress(),
      });
    }
    if (body.action === "session.resume") {
      if (!hasStudent || body.auth?.deviceToken === "expired-device-token-123456789") {
        return success(route, { status: "unauthenticated" });
      }
      return success(route, { status: "authenticated", progress: progress() });
    }
    if (body.action === "brushing.start") {
      return success(route, {
        attemptId: "attempt-1",
        attemptToken: "signed-attempt-token-1234567890",
        durationSec: body.payload?.selectedDurationSec ?? 60,
        issuedAtMs: Date.now(),
      });
    }
    if (body.action === "completion.submit") {
      completionRequests += 1;
      completionPayloads.push(body.payload);
      if (options.loseFirstCompletionResponse && completionRequests === 1) {
        await route.abort("internetdisconnected");
        return;
      }
      if (acceptedDays === (options.acceptedDays ?? 0)) acceptedDays += 1;
      return success(route, {
        completionId: "completion-1",
        challengeId: "ABC123",
        participationDate: "2026-09-23",
        acceptedDays,
        targetDays: 5,
        newlyAccepted: completionRequests === 1,
      });
    }
    if (body.action === "progress.get") return success(route, progress());

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: { code: "UNKNOWN_ACTION", message: "unknown" },
      }),
    });
  });

  return {
    completionRequests: () => completionRequests,
    completionPayloads: () => completionPayloads,
  };
}

export async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });
}
