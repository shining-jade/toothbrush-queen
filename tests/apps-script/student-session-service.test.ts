import { beforeEach, describe, expect, it } from "vitest";

import { ProgressService } from "../../apps-script/src/domain/progress-service";
import { StudentSessionService } from "../../apps-script/src/domain/student-session-service";
import type { SecurityProvider } from "../../apps-script/src/platform/security";
import { ChallengeRepository } from "../../apps-script/src/repositories/challenge-repository";
import { CompletionRepository } from "../../apps-script/src/repositories/completion-repository";
import { DeviceSessionRepository } from "../../apps-script/src/repositories/device-session-repository";
import { StudentRepository } from "../../apps-script/src/repositories/student-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

const now = new Date("2026-09-23T00:00:00.000Z");

class FakeSecurity implements SecurityProvider {
  randomToken() {
    return "a".repeat(64);
  }
  sha256(value: string) {
    return `hash:${value}`;
  }

  safeEqual(left: string, right: string) {
    return left === right;
  }
}

describe("StudentSessionService", () => {
  let memory: InMemorySheetGateway;
  let sessions: DeviceSessionRepository;
  let service: StudentSessionService;

  beforeEach(() => {
    memory = new InMemorySheetGateway();
    const challenges = new ChallengeRepository(memory);
    const students = new StudentRepository(memory);
    sessions = new DeviceSessionRepository(memory);
    const completions = new CompletionRepository(memory);
    challenges.insert({
      challengeId: "ABC123", name: "5일 양치왕", startDate: "2026-09-20",
      endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul",
      durationMode: "choice", dailyLimit: 1, status: "active",
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
    const progress = new ProgressService(challenges, students, completions, () => now);
    service = new StudentSessionService(
      challenges, students, sessions, progress, new FakeSecurity(), () => now,
    );
  });

  it("stores only a device-token hash and resumes with the raw token", () => {
    const result = service.join({
      challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: "김민지",
    });

    expect(result.deviceToken).toHaveLength(64);
    expect(memory.readAll("DeviceSessions")[0][0]).toBe(`hash:${result.deviceToken}`);
    const resumed = service.resume(result.deviceToken, "ABC123");
    expect(resumed.status).toBe("authenticated");
    if (resumed.status === "authenticated") {
      expect(resumed.progress.studentId).toBe(result.progress.studentId);
      expect(resumed.progress.displayName).toBe("2학년 3반 12번 김○○");
    }
  });

  it("reuses the existing student identity instead of inserting a duplicate", () => {
    const input = { challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: "김민지" };
    service.join(input);
    service.join({ ...input, name: " 김민지 " });
    expect(memory.readAll("Students")).toHaveLength(1);
  });

  it.each(["", "bad-token"])(
    "returns unauthenticated for %s",
    (token) => {
      expect(service.resume(token, "ABC123")).toEqual({ status: "unauthenticated" });
    },
  );

  it("returns the same unauthenticated shape for expired and revoked sessions", () => {
    const joined = service.join({
      challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: "김민지",
    });
    sessions.insert({
      tokenHash: "hash:expired-token", studentId: joined.progress.studentId,
      challengeId: "ABC123", createdAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2025-01-02T00:00:00.000Z", lastUsedAt: "2025-01-01T00:00:00.000Z", revokedAt: "",
    });
    sessions.insert({
      tokenHash: "hash:revoked-token", studentId: joined.progress.studentId,
      challengeId: "ABC123", createdAt: now.toISOString(),
      expiresAt: "2027-01-01T00:00:00.000Z", lastUsedAt: now.toISOString(), revokedAt: now.toISOString(),
    });

    expect(service.resume("expired-token", "ABC123")).toEqual({ status: "unauthenticated" });
    expect(service.resume("revoked-token", "ABC123")).toEqual({ status: "unauthenticated" });
  });
});
