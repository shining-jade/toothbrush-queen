import { describe, expect, it } from "vitest";

import * as sheetSchema from "../../apps-script/src/schema";
import { assertSheetHeaders, SHEET_SCHEMAS } from "../../apps-script/src/schema";
import { ChallengeRepository } from "../../apps-script/src/repositories/challenge-repository";
import { CompletionRepository } from "../../apps-script/src/repositories/completion-repository";
import { DeviceSessionRepository } from "../../apps-script/src/repositories/device-session-repository";
import { StudentRepository } from "../../apps-script/src/repositories/student-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

describe("Sheets repositories", () => {
  it("uses Korean worksheet names and Korean column headers", () => {
    expect((sheetSchema as Record<string, unknown>).SHEET_TITLES).toEqual({
      Challenges: "챌린지",
      Students: "학생",
      DeviceSessions: "기기세션",
      Completions: "완료기록",
      Assets: "자산",
      Skins: "스킨",
    });
    expect(SHEET_SCHEMAS.Students).toEqual([
      "학생ID", "챌린지ID", "학년", "반", "번호", "이름", "생성일시", "수정일시", "상태",
    ]);
    expect(SHEET_SCHEMAS.Completions).toContain("소감");
  });

  it("finds a student by normalized challenge identity", () => {
    const memory = new InMemorySheetGateway();
    const repo = new StudentRepository(memory);
    repo.insert({
      studentId: "stu-1",
      challengeId: "ABC123",
      grade: "2",
      classNo: "3",
      studentNo: "12",
      name: "김민지",
      createdAt: "2026-09-23T00:00:00.000Z",
      updatedAt: "2026-09-23T00:00:00.000Z",
      status: "active",
    });

    expect(repo.findByIdentity("ABC123", "2", "3", "12", " 김민지 ")?.studentId).toBe(
      "stu-1",
    );
  });

  it("finds the original completion by idempotency key", () => {
    const memory = new InMemorySheetGateway();
    const repo = new CompletionRepository(memory);
    repo.insert({
      completionId: "cmp-1",
      idempotencyKey: "key-1",
      challengeId: "ABC123",
      studentId: "stu-1",
      participationDate: "2026-09-23",
      attemptId: "attempt-1",
      attemptIndex: 1,
      selectedDurationSec: 60,
      elapsedSec: 60,
      faceDetectedSec: null,
      cameraMode: "timer-only",
      completed: true,
      stampGranted: true,
      createdAt: "2026-09-23T00:01:00.000Z",
    });

    expect(repo.findByIdempotencyKey("key-1")?.completionId).toBe("cmp-1");
  });

  it("round-trips the free brushing mode without numeric coercion", () => {
    const memory = new InMemorySheetGateway();
    const repo = new CompletionRepository(memory);
    repo.insert({
      completionId: "cmp-free",
      idempotencyKey: "key-free",
      challengeId: "ABC123",
      studentId: "stu-1",
      participationDate: "2026-09-23",
      attemptId: "attempt-free",
      attemptIndex: 1,
      selectedDurationSec: "free",
      elapsedSec: 84,
      faceDetectedSec: 80,
      cameraMode: "camera",
      completed: true,
      stampGranted: true,
      createdAt: "2026-09-23T00:01:24.000Z",
    });

    expect(repo.findByIdempotencyKey("key-free")?.selectedDurationSec).toBe("free");
  });

  it("round-trips a student's final reflection", () => {
    const memory = new InMemorySheetGateway();
    const repo = new CompletionRepository(memory);
    repo.insert({
      completionId: "cmp-reflection",
      idempotencyKey: "key-reflection",
      challengeId: "ABC123",
      studentId: "stu-1",
      participationDate: "2026-09-23",
      attemptId: "attempt-reflection",
      attemptIndex: 5,
      selectedDurationSec: 180,
      elapsedSec: 180,
      faceDetectedSec: 175,
      cameraMode: "camera",
      completed: true,
      stampGranted: true,
      reflection: "매일 양치하는 습관이 생겼어요.",
      createdAt: "2026-09-23T00:03:00.000Z",
    });

    expect(repo.findByIdempotencyKey("key-reflection")?.reflection).toBe(
      "매일 양치하는 습관이 생겼어요.",
    );
  });

  it("round-trips challenges and device sessions", () => {
    const memory = new InMemorySheetGateway();
    const challenges = new ChallengeRepository(memory);
    const sessions = new DeviceSessionRepository(memory);
    challenges.insert({
      challengeId: "ABC123",
      name: "5일 양치왕",
      startDate: "2026-09-23",
      endDate: "2026-09-30",
      targetDays: 5,
      timeZone: "Asia/Seoul",
      durationMode: "choice",
      dailyLimit: 1,
      status: "active",
      createdAt: "2026-09-23T00:00:00.000Z",
      updatedAt: "2026-09-23T00:00:00.000Z",
    });
    sessions.insert({
      tokenHash: "hash-1",
      studentId: "stu-1",
      challengeId: "ABC123",
      createdAt: "2026-09-23T00:00:00.000Z",
      expiresAt: "2027-09-23T00:00:00.000Z",
      lastUsedAt: "2026-09-23T00:00:00.000Z",
      revokedAt: "",
    });

    expect(challenges.findById("ABC123")?.targetDays).toBe(5);
    expect(sessions.findByTokenHash("hash-1")?.studentId).toBe("stu-1");
  });

  it("normalizes Google Sheets date cells to YYYY-MM-DD", () => {
    const memory = new InMemorySheetGateway();
    const challenges = new ChallengeRepository(memory);
    memory.append("Challenges", [
      "BRUSH5",
      "5일 양치왕 챌린지",
      new Date(2026, 8, 23),
      new Date(2026, 8, 27),
      5,
      "Asia/Seoul",
      "choice",
      1,
      "active",
      "2026-09-23T15:57:00+09:00",
      "2026-09-23T15:57:00+09:00",
    ]);

    expect(challenges.findById("BRUSH5")).toMatchObject({
      startDate: "2026-09-23",
      endDate: "2026-09-27",
    });
  });

  it("rejects a sheet whose headers are out of order", () => {
    expect(() => assertSheetHeaders("Students", ["학생ID", "이름"])).toThrow(
      "SHEET_SCHEMA_MISMATCH:Students",
    );
  });
});
