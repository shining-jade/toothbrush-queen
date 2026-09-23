import type {
  JoinStudentInput,
  JoinStudentResult,
  ResumeStudentResult,
} from "../../../src/shared/contracts";
import type { SecurityProvider } from "../platform/security";
import type { ChallengeRepository } from "../repositories/challenge-repository";
import type { DeviceSessionRepository } from "../repositories/device-session-repository";
import type { StudentRepository } from "../repositories/student-repository";
import type { ProgressService } from "./progress-service";

const SESSION_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

export class StudentSessionService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly students: StudentRepository,
    private readonly sessions: DeviceSessionRepository,
    private readonly progress: ProgressService,
    private readonly security: SecurityProvider,
    private readonly now: () => Date,
  ) {}

  join(input: JoinStudentInput): JoinStudentResult {
    const challenge = this.challenges.findById(input.challengeId);
    if (!challenge || challenge.status !== "active") throw new Error("CHALLENGE_NOT_ACTIVE");

    const timestamp = this.now().toISOString();
    const existing = this.students.findByIdentity(
      input.challengeId, input.grade, input.classNo, input.studentNo, input.name,
    );
    const student = existing ?? this.students.insert({
      studentId: `stu-${this.security.randomToken().slice(0, 24)}`,
      challengeId: input.challengeId,
      grade: input.grade.trim(), classNo: input.classNo.trim(), studentNo: input.studentNo.trim(),
      name: input.name.trim(), createdAt: timestamp, updatedAt: timestamp, status: "active",
    });
    const deviceToken = this.security.randomToken();
    this.sessions.insert({
      tokenHash: this.security.sha256(deviceToken),
      studentId: student.studentId,
      challengeId: input.challengeId,
      createdAt: timestamp,
      expiresAt: new Date(this.now().getTime() + SESSION_LIFETIME_MS).toISOString(),
      lastUsedAt: timestamp,
      revokedAt: "",
    });
    return { deviceToken, progress: this.progress.get(student.studentId, input.challengeId) };
  }

  resume(rawToken: string, challengeId: string): ResumeStudentResult {
    if (rawToken.length < 20) return { status: "unauthenticated" };
    const session = this.sessions.findByTokenHash(this.security.sha256(rawToken));
    if (
      !session || session.challengeId !== challengeId || session.revokedAt ||
      new Date(session.expiresAt).getTime() <= this.now().getTime()
    ) return { status: "unauthenticated" };
    const student = this.students.findById(session.studentId);
    if (!student || student.status !== "active") return { status: "unauthenticated" };
    return { status: "authenticated", progress: this.progress.get(student.studentId, challengeId) };
  }
}
