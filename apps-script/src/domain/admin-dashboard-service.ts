import {
  AdminDashboardResultSchema,
  type AdminDashboardResult,
  type Challenge,
} from "../../../src/shared/contracts";
import type { ChallengeRepository } from "../repositories/challenge-repository";
import type { CompletionRepository } from "../repositories/completion-repository";
import type { StudentRepository } from "../repositories/student-repository";
import type { AdminAuthService } from "./admin-auth-service";

export class AdminDashboardService {
  constructor(
    private readonly auth: Pick<AdminAuthService, "requireSession">,
    private readonly challenges: ChallengeRepository,
    private readonly students: StudentRepository,
    private readonly completions: CompletionRepository,
    private readonly now: () => Date,
    private readonly formatDate: (date: Date, timeZone: string) => string,
  ) {}

  get(adminToken: string, challengeId: string): AdminDashboardResult {
    this.auth.requireSession(adminToken);
    const storedChallenge = this.challenges.findById(challengeId);
    if (!storedChallenge) throw new Error("CHALLENGE_NOT_FOUND");
    const challenge: Challenge = {
      challengeId: storedChallenge.challengeId,
      name: storedChallenge.name,
      startDate: storedChallenge.startDate,
      endDate: storedChallenge.endDate,
      targetDays: storedChallenge.targetDays,
      timeZone: storedChallenge.timeZone,
      durationMode: storedChallenge.durationMode,
      dailyLimit: storedChallenge.dailyLimit,
      status: storedChallenge.status,
    };
    const today = this.formatDate(this.now(), challenge.timeZone);
    const completions = this.completions.listByChallenge(challengeId)
      .filter((completion) => completion.completed && completion.stampGranted);
    const students = this.students.listByChallenge(challengeId)
      .filter((student) => student.status === "active")
      .sort((left, right) => [left.grade, left.classNo, left.studentNo]
        .join("\u0000").localeCompare([right.grade, right.classNo, right.studentNo].join("\u0000"), "ko-KR", { numeric: true }))
      .map((student) => {
        const acceptedDates = [...new Set(completions
          .filter((completion) => completion.studentId === student.studentId)
          .map((completion) => completion.participationDate))]
          .sort();
        const acceptedDays = acceptedDates.length;
        const completedToday = acceptedDates.includes(today);
        const participationStatus = acceptedDays >= challenge.targetDays
          ? "completed" as const
          : completedToday
            ? "completedToday" as const
            : acceptedDays === 0
              ? "noRecord" as const
              : "missingToday" as const;
        return {
          studentId: student.studentId,
          grade: student.grade,
          classNo: student.classNo,
          studentNo: student.studentNo,
          name: student.name,
          acceptedDays,
          targetDays: challenge.targetDays,
          completedToday,
          lastParticipationDate: acceptedDates.at(-1) ?? null,
          participationStatus,
        };
      });
    return AdminDashboardResultSchema.parse({
      challenge,
      summary: {
        totalStudents: students.length,
        completedToday: students.filter((student) => student.completedToday).length,
        missingToday: students.filter((student) => !student.completedToday).length,
        completedChallenge: students.filter((student) => student.acceptedDays >= challenge.targetDays).length,
      },
      students,
    });
  }
}
