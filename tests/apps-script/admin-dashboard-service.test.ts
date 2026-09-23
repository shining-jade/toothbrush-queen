import { describe, expect, it, vi } from "vitest";

import { AdminDashboardService } from "../../apps-script/src/domain/admin-dashboard-service";
import { ChallengeRepository } from "../../apps-script/src/repositories/challenge-repository";
import { CompletionRepository, type CompletionRow } from "../../apps-script/src/repositories/completion-repository";
import { StudentRepository } from "../../apps-script/src/repositories/student-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

const createdAt = "2026-09-23T00:00:00.000Z";

function completion(overrides: Partial<CompletionRow>): CompletionRow {
  return {
    completionId: `cmp-${Math.random()}`,
    idempotencyKey: crypto.randomUUID(),
    challengeId: "ABC123",
    studentId: "stu-1",
    participationDate: "2026-09-23",
    attemptId: `attempt-${Math.random()}`,
    attemptIndex: 1,
    selectedDurationSec: 60,
    elapsedSec: 60,
    faceDetectedSec: null,
    cameraMode: "timer-only",
    completed: true,
    stampGranted: true,
    createdAt,
    ...overrides,
  };
}

describe("AdminDashboardService", () => {
  it("summarizes only the selected challenge and assigns teacher-facing statuses", () => {
    const gateway = new InMemorySheetGateway();
    const challenges = new ChallengeRepository(gateway);
    const students = new StudentRepository(gateway);
    const completions = new CompletionRepository(gateway);
    const requireSession = vi.fn();
    challenges.insert({
      challengeId: "ABC123", name: "5일 양치왕", startDate: "2026-09-20",
      endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul",
      durationMode: "choice", dailyLimit: 1, status: "active", createdAt, updatedAt: createdAt,
    });
    for (const [studentId, studentNo, name] of [
      ["stu-1", "1", "완주학생"],
      ["stu-2", "2", "오늘학생"],
      ["stu-3", "3", "미참여학생"],
      ["stu-4", "4", "신규학생"],
    ]) {
      students.insert({ studentId, challengeId: "ABC123", grade: "2", classNo: "3", studentNo, name, createdAt, updatedAt: createdAt, status: "active" });
    }
    students.insert({ studentId: "other-stu", challengeId: "OTHER1", grade: "1", classNo: "1", studentNo: "1", name: "다른챌린지", createdAt, updatedAt: createdAt, status: "active" });
    for (const date of ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"]) {
      completions.insert(completion({ studentId: "stu-1", participationDate: date }));
    }
    completions.insert(completion({ studentId: "stu-2" }));
    completions.insert(completion({ studentId: "stu-3", participationDate: "2026-09-22" }));
    completions.insert(completion({ challengeId: "OTHER1", studentId: "other-stu" }));

    const service = new AdminDashboardService(
      { requireSession }, challenges, students, completions,
      () => new Date("2026-09-23T03:00:00.000Z"),
      () => "2026-09-23",
    );
    const result = service.get("admin-token", "ABC123");

    expect(requireSession).toHaveBeenCalledWith("admin-token");
    expect(result.summary).toEqual({
      totalStudents: 4,
      completedToday: 2,
      missingToday: 2,
      completedChallenge: 1,
    });
    expect(result.students.map((student) => student.participationStatus)).toEqual([
      "completed",
      "completedToday",
      "missingToday",
      "noRecord",
    ]);
    expect(result.students[0]).toMatchObject({ acceptedDays: 5, completedToday: true, lastParticipationDate: "2026-09-23" });
  });
});
