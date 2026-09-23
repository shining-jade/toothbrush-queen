import type { StudentProgress } from "../../../src/shared/contracts";
import type { ChallengeRepository } from "../repositories/challenge-repository";
import type { CompletionRepository } from "../repositories/completion-repository";
import type { StudentRepository } from "../repositories/student-repository";

const maskName = (name: string) => {
  const chars = Array.from(name.trim());
  return `${chars[0] ?? ""}${"○".repeat(Math.max(1, chars.length - 1))}`;
};

export class ProgressService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly students: StudentRepository,
    private readonly completions: CompletionRepository,
    private readonly now: () => Date,
    private readonly formatDate: (date: Date, timeZone: string) => string = (date) =>
      date.toISOString().slice(0, 10),
  ) {}

  get(studentId: string, challengeId: string): StudentProgress {
    const challenge = this.challenges.findById(challengeId);
    const student = this.students.findById(studentId);
    if (!challenge || !student || student.challengeId !== challengeId) {
      throw new Error("STUDENT_NOT_FOUND");
    }
    const accepted = this.completions
      .listByStudent(studentId)
      .filter((completion) => completion.completed && completion.stampGranted);
    const acceptedDates = new Set(accepted.map((completion) => completion.participationDate));
    const today = this.formatDate(this.now(), challenge.timeZone);
    return {
      challengeId,
      studentId,
      displayName: `${student.grade}학년 ${student.classNo}반 ${student.studentNo}번 ${maskName(student.name)}`,
      acceptedDays: acceptedDates.size,
      targetDays: challenge.targetDays,
      completedToday: acceptedDates.has(today),
    };
  }
}
