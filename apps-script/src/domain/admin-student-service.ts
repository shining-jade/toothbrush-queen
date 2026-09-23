import type { AdminAuthService } from "./admin-auth-service";
import type { ExclusiveLock } from "../platform/lock";
import type { CompletionRepository } from "../repositories/completion-repository";
import type { DeviceSessionRepository } from "../repositories/device-session-repository";
import type { StudentRepository } from "../repositories/student-repository";

export class AdminStudentService {
  constructor(
    private readonly auth: Pick<AdminAuthService, "requireSession">,
    private readonly students: StudentRepository,
    private readonly completions: CompletionRepository,
    private readonly sessions: DeviceSessionRepository,
    private readonly lock: ExclusiveLock,
  ) {}

  delete(token: string, challengeId: string, studentId: string) {
    this.auth.requireSession(token);
    return this.lock.runExclusive(() => {
      const student = this.students.findById(studentId);
      if (!student || student.challengeId !== challengeId) throw new Error("STUDENT_NOT_FOUND");
      this.completions.deleteByStudent(studentId);
      this.sessions.deleteByStudent(studentId);
      this.students.deleteById(studentId);
      return { deleted: true as const, challengeId, studentId };
    });
  }
}
