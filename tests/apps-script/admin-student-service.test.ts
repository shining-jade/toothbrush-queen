import { describe, expect, it, vi } from "vitest";

import { AdminStudentService } from "../../apps-script/src/domain/admin-student-service";
import { CompletionRepository } from "../../apps-script/src/repositories/completion-repository";
import { DeviceSessionRepository } from "../../apps-script/src/repositories/device-session-repository";
import { StudentRepository } from "../../apps-script/src/repositories/student-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

const createdAt = "2026-09-23T00:00:00.000Z";

describe("AdminStudentService", () => {
  it("permanently deletes only the selected student's profile, completions, and device sessions", () => {
    const gateway = new InMemorySheetGateway();
    const students = new StudentRepository(gateway);
    const completions = new CompletionRepository(gateway);
    const sessions = new DeviceSessionRepository(gateway);
    const requireSession = vi.fn();
    const lock = { runExclusive: <T,>(operation: () => T) => operation() };

    students.insert({ studentId: "stu-1", challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: "김민지", createdAt, updatedAt: createdAt, status: "active" });
    students.insert({ studentId: "stu-2", challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "13", name: "이학생", createdAt, updatedAt: createdAt, status: "active" });
    completions.insert({ completionId: "cmp-1", idempotencyKey: "key-1", challengeId: "ABC123", studentId: "stu-1", participationDate: "2026-09-23", attemptId: "attempt-1", attemptIndex: 1, selectedDurationSec: 60, elapsedSec: 60, faceDetectedSec: null, cameraMode: "timer-only", completed: true, stampGranted: true, reflection: "상쾌했어요", createdAt });
    completions.insert({ completionId: "cmp-2", idempotencyKey: "key-2", challengeId: "ABC123", studentId: "stu-2", participationDate: "2026-09-23", attemptId: "attempt-2", attemptIndex: 1, selectedDurationSec: 60, elapsedSec: 60, faceDetectedSec: null, cameraMode: "timer-only", completed: true, stampGranted: true, createdAt });
    sessions.insert({ tokenHash: "hash-1", studentId: "stu-1", challengeId: "ABC123", createdAt, expiresAt: createdAt, lastUsedAt: createdAt, revokedAt: "" });
    sessions.insert({ tokenHash: "hash-2", studentId: "stu-2", challengeId: "ABC123", createdAt, expiresAt: createdAt, lastUsedAt: createdAt, revokedAt: "" });

    const service = new AdminStudentService({ requireSession }, students, completions, sessions, lock);
    const result = service.delete("admin-token", "ABC123", "stu-1");

    expect(requireSession).toHaveBeenCalledWith("admin-token");
    expect(result).toEqual({ deleted: true, challengeId: "ABC123", studentId: "stu-1" });
    expect(students.findById("stu-1")).toBeNull();
    expect(completions.listByStudent("stu-1")).toEqual([]);
    expect(sessions.listByStudent("stu-1")).toEqual([]);
    expect(students.findById("stu-2")?.name).toBe("이학생");
    expect(completions.listByStudent("stu-2")).toHaveLength(1);
    expect(sessions.listByStudent("stu-2")).toHaveLength(1);
  });

  it("refuses to delete a student through the wrong challenge", () => {
    const gateway = new InMemorySheetGateway();
    const students = new StudentRepository(gateway);
    students.insert({ studentId: "stu-1", challengeId: "ABC123", grade: "2", classNo: "3", studentNo: "12", name: "김민지", createdAt, updatedAt: createdAt, status: "active" });
    const service = new AdminStudentService(
      { requireSession: vi.fn() },
      students,
      new CompletionRepository(gateway),
      new DeviceSessionRepository(gateway),
      { runExclusive: <T,>(operation: () => T) => operation() },
    );

    expect(() => service.delete("admin-token", "OTHER1", "stu-1")).toThrow("STUDENT_NOT_FOUND");
    expect(students.findById("stu-1")).not.toBeNull();
  });
});
