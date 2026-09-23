import { describe, expect, it } from "vitest";

import {
  AdminAssetUploadInputSchema,
  AdminSkinDraftSchema,
  ApiRequestSchema,
  ChallengeSchema,
  JoinStudentInputSchema,
  PublicSkinSchema,
  StartAttemptInputSchema,
  StudentProgressSchema,
  SubmitCompletionInputSchema,
} from "@/shared/contracts";

describe("API contracts", () => {
  it("accepts calibrated public skins and administrator authentication", () => {
    expect(PublicSkinSchema.parse({
      skinId: "skin-flower-1", name: "꽃님 사진관",
      imageUrl: "https://drive.google.com/uc?id=file-1",
      anchorX: 0, anchorY: -0.42, scale: 1.4, rotationOffset: 0,
      version: 1, sortOrder: 10,
    })).toMatchObject({ skinId: "skin-flower-1", scale: 1.4 });
    expect(ApiRequestSchema.parse({
      action: "admin.skin.list", auth: { adminToken: "a".repeat(32) }, payload: {},
    })).toMatchObject({ auth: { adminToken: "a".repeat(32) } });
  });

  it("rejects unsupported administrator assets and unsafe calibration", () => {
    expect(() => AdminAssetUploadInputSchema.parse({
      name: "bad", fileName: "bad.svg", mimeType: "image/svg+xml",
      byteSize: 20, base64: "PHN2Zz4=",
    })).toThrow();
    expect(AdminSkinDraftSchema.safeParse({
      assetId: "asset-1", name: "huge", anchorX: 0, anchorY: 0,
      scale: 4, rotationOffset: 0, enabled: false, sortOrder: 1,
    }).success).toBe(false);
  });
  it("normalizes student fields but preserves the display name", () => {
    const parsed = JoinStudentInputSchema.parse({
      challengeId: "ABC123",
      grade: "2",
      classNo: "3",
      studentNo: "12",
      name: " 김민지 ",
    });

    expect(parsed.name).toBe("김민지");
  });

  it("rejects camera and landmark data in completion payloads", () => {
    const result = SubmitCompletionInputSchema.safeParse({
      challengeId: "ABC123",
      attemptToken: "signed-attempt-token-value",
      idempotencyKey: crypto.randomUUID(),
      elapsedSec: 60,
      faceDetectedSec: null,
      cameraMode: "timer-only",
      image: "data:image/png;base64,...",
    });

    expect(result.success).toBe(false);
  });

  it("accepts only the supported challenge duration modes", () => {
    const base = {
      challengeId: "ABC123",
      name: "우리 반 5일 챌린지",
      startDate: "2026-09-23",
      endDate: "2026-09-30",
      targetDays: 5,
      timeZone: "Asia/Seoul",
      dailyLimit: 1,
      status: "active",
    };

    expect(ChallengeSchema.parse({ ...base, durationMode: "choice" }).durationMode).toBe(
      "choice",
    );
    expect(ChallengeSchema.safeParse({ ...base, durationMode: 120 }).success).toBe(false);
  });

  it("keeps masked display text separate from student identity", () => {
    const progress = StudentProgressSchema.parse({
      challengeId: "ABC123",
      studentId: "stu-1",
      displayName: "2학년 3반 12번 김○○",
      acceptedDays: 1,
      targetDays: 5,
      completedToday: true,
    });

    expect(progress.displayName).toBe("2학년 3반 12번 김○○");
    expect("name" in progress).toBe(false);
  });

  it("requires a supported selected duration to start an attempt", () => {
    expect(
      StartAttemptInputSchema.parse({
        challengeId: "ABC123",
        selectedDurationSec: "free",
      }),
    ).toEqual({ challengeId: "ABC123", selectedDurationSec: "free" });

    expect(
      StartAttemptInputSchema.safeParse({
        challengeId: "ABC123",
        selectedDurationSec: 90,
      }).success,
    ).toBe(false);
  });
});
