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
  adminPassword?: string;
  expireFirstAdminUpload?: boolean;
};

export async function mockAppsScript(page: Page, options: MockOptions = {}) {
  let acceptedDays = options.acceptedDays ?? 0;
  let completionRequests = 0;
  const completionPayloads: unknown[] = [];
  let hasStudent = false;
  let adminUploadRequests = 0;
  let nextAssetId = 1;
  const adminSkins: Array<{
    skinId: string; assetId: string; name: string; imageUrl: string;
    anchorX: number; anchorY: number; scale: number; rotationOffset: number;
    version: number; sortOrder: number; enabled: boolean; updatedAt: string;
  }> = [];

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
  const failure = (route: Route, code: string, message: string) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code, message } }),
  });

  await page.route(APPS_SCRIPT_TEST_URL, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      action?: string;
      auth?: { deviceToken?: string; adminToken?: string };
      payload?: Record<string, unknown>;
    };

    if (body.action === "challenge.get") return success(route, {
      ...challenge,
      durationMode: options.durationMode ?? challenge.durationMode,
      skins: adminSkins.filter((skin) => skin.enabled).map((skin) => ({
        skinId: skin.skinId, name: skin.name, imageUrl: skin.imageUrl,
        anchorX: skin.anchorX, anchorY: skin.anchorY, scale: skin.scale,
        rotationOffset: skin.rotationOffset, version: skin.version, sortOrder: skin.sortOrder,
      })),
    });
    if (body.action === "admin.login") {
      if (body.payload?.password !== options.adminPassword) return failure(route, "ADMIN_LOGIN_FAILED", "비밀번호를 확인해 주세요.");
      return success(route, { adminToken: "a".repeat(32), expiresAtMs: Date.now() + 4 * 60 * 60 * 1000 });
    }
    if (body.action === "admin.dashboard.get") {
      if (!body.auth?.adminToken) return failure(route, "ADMIN_SESSION_EXPIRED", "관리자 로그인이 필요합니다.");
      return success(route, {
        challenge: { ...challenge, challengeId: String(body.payload?.challengeId ?? challenge.challengeId) },
        summary: { totalStudents: 3, completedToday: 1, missingToday: 2, completedChallenge: 1 },
        students: [
          { studentId: "student-1", grade: "2", classNo: "3", studentNo: "12", name: "김민지", acceptedDays: 5, targetDays: challenge.targetDays, completedToday: true, lastParticipationDate: "2026-09-23", participationStatus: "completed" },
          { studentId: "student-2", grade: "2", classNo: "4", studentNo: "7", name: "이서준", acceptedDays: 2, targetDays: challenge.targetDays, completedToday: false, lastParticipationDate: "2026-09-22", participationStatus: "missingToday" },
          { studentId: "student-3", grade: "3", classNo: "1", studentNo: "2", name: "박지우", acceptedDays: 0, targetDays: challenge.targetDays, completedToday: false, lastParticipationDate: null, participationStatus: "noRecord" },
        ],
      });
    }
    if (body.action === "admin.challenge.save") {
      if (!body.auth?.adminToken) return failure(route, "ADMIN_SESSION_EXPIRED", "관리자 로그인이 필요합니다.");
      Object.assign(challenge, body.payload);
      return success(route, challenge);
    }
    if (body.action === "admin.skin.list") {
      if (!body.auth?.adminToken) return failure(route, "ADMIN_SESSION_EXPIRED", "관리자 로그인이 필요합니다.");
      return success(route, adminSkins);
    }
    if (body.action === "admin.asset.upload") {
      adminUploadRequests += 1;
      if (options.expireFirstAdminUpload && adminUploadRequests === 1) {
        return failure(route, "ADMIN_SESSION_EXPIRED", "관리자 로그인이 필요합니다.");
      }
      if (typeof body.payload?.base64 !== "string" || body.payload.base64.length === 0) {
        return failure(route, "INVALID_REQUEST", "이미지를 확인해 주세요.");
      }
      const assetId = `asset-${nextAssetId++}`;
      return success(route, { assetId, publicUrl: `https://example.com/${assetId}.png` });
    }
    if (body.action === "admin.skin.save") {
      const payload = body.payload ?? {};
      const saved = {
        skinId: `skin-uploaded-${adminSkins.length + 1}`,
        assetId: String(payload.assetId), name: String(payload.name),
        imageUrl: `https://example.com/${String(payload.assetId)}.png`,
        anchorX: Number(payload.anchorX), anchorY: Number(payload.anchorY), scale: Number(payload.scale),
        rotationOffset: Number(payload.rotationOffset), version: 1, sortOrder: Number(payload.sortOrder),
        enabled: Boolean(payload.enabled), updatedAt: new Date().toISOString(),
      };
      adminSkins.push(saved);
      return success(route, saved);
    }
    if (body.action === "admin.skin.setEnabled") {
      const skin = adminSkins.find((item) => item.skinId === body.payload?.skinId);
      if (!skin) return failure(route, "SKIN_NOT_FOUND", "스킨을 찾을 수 없습니다.");
      skin.enabled = Boolean(body.payload?.enabled);
      return success(route, skin);
    }
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
