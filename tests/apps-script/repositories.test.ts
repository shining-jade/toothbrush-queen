import { describe, expect, it } from "vitest";

import { assertSheetHeaders } from "../../apps-script/src/schema";
import { ChallengeRepository } from "../../apps-script/src/repositories/challenge-repository";
import { CompletionRepository } from "../../apps-script/src/repositories/completion-repository";
import { DeviceSessionRepository } from "../../apps-script/src/repositories/device-session-repository";
import { StudentRepository } from "../../apps-script/src/repositories/student-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

describe("Sheets repositories", () => {
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

  it("rejects a sheet whose headers are out of order", () => {
    expect(() => assertSheetHeaders("Students", ["studentId", "name"])).toThrow(
      "SHEET_SCHEMA_MISMATCH:Students",
    );
  });
});
