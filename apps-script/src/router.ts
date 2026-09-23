import {
  ApiRequestSchema,
  ChallengeIdSchema,
  JoinStudentInputSchema,
  SessionResumeInputSchema,
  type ApiResponse,
  type Challenge,
  type JoinStudentResult,
  type ResumeStudentResult,
  type StudentProgress,
} from "../../src/shared/contracts";
import { ProgressService } from "./domain/progress-service";
import { StudentSessionService } from "./domain/student-session-service";
import { GoogleSheetGateway } from "./platform/google-sheet-gateway";
import { AppsScriptSecurityProvider } from "./platform/security";
import { ChallengeRepository } from "./repositories/challenge-repository";
import { CompletionRepository } from "./repositories/completion-repository";
import { DeviceSessionRepository } from "./repositories/device-session-repository";
import { StudentRepository } from "./repositories/student-repository";

export type RouterServices = {
  getChallenge(challengeId: string): Challenge | null;
  joinStudent(input: Parameters<StudentSessionService["join"]>[0]): JoinStudentResult;
  resumeStudent(token: string, challengeId: string): ResumeStudentResult;
  getProgress(token: string, challengeId: string): StudentProgress;
};

const errorMessages: Record<string, string> = {
  ACTION_NOT_FOUND: "요청을 처리할 수 없습니다.",
  CHALLENGE_NOT_FOUND: "챌린지를 찾을 수 없습니다.",
  UNAUTHENTICATED: "인증이 필요합니다.",
  INVALID_REQUEST: "입력 내용을 확인해 주세요.",
};

const failure = (code: string): ApiResponse => ({
  ok: false,
  error: { code, message: errorMessages[code] ?? "요청 처리 중 오류가 발생했습니다." },
});

export function createRouter(services: RouterServices) {
  return (rawRequest: unknown): ApiResponse => {
    try {
      const request = ApiRequestSchema.parse(rawRequest);
      if (request.action === "challenge.get") {
        const payload = SessionResumeInputSchema.parse(request.payload);
        const challenge = services.getChallenge(payload.challengeId);
        return challenge ? { ok: true, data: challenge } : failure("CHALLENGE_NOT_FOUND");
      }
      if (request.action === "student.join") {
        return { ok: true, data: services.joinStudent(JoinStudentInputSchema.parse(request.payload)) };
      }
      if (request.action === "session.resume") {
        const payload = SessionResumeInputSchema.parse(request.payload);
        return { ok: true, data: services.resumeStudent(request.auth?.deviceToken ?? "", payload.challengeId) };
      }
      if (request.action === "progress.get") {
        const payload = SessionResumeInputSchema.parse(request.payload);
        return { ok: true, data: services.getProgress(request.auth?.deviceToken ?? "", payload.challengeId) };
      }
      return failure("ACTION_NOT_FOUND");
    } catch (error) {
      const code = error instanceof Error && error.message === "UNAUTHENTICATED"
        ? "UNAUTHENTICATED"
        : "INVALID_REQUEST";
      return failure(code);
    }
  };
}

export function createProductionRouter() {
  const gateway = new GoogleSheetGateway();
  const challenges = new ChallengeRepository(gateway);
  const students = new StudentRepository(gateway);
  const sessions = new DeviceSessionRepository(gateway);
  const completions = new CompletionRepository(gateway);
  const now = () => new Date();
  const progress = new ProgressService(
    challenges, students, completions, now,
    (date, timeZone) => Utilities.formatDate(date, timeZone, "yyyy-MM-dd"),
  );
  const studentSessions = new StudentSessionService(
    challenges, students, sessions, progress, new AppsScriptSecurityProvider(), now,
  );
  return createRouter({
    getChallenge(challengeId) {
      const challenge = challenges.findById(ChallengeIdSchema.parse(challengeId));
      if (!challenge || challenge.status !== "active") return null;
      return {
        challengeId: challenge.challengeId, name: challenge.name, startDate: challenge.startDate,
        endDate: challenge.endDate, targetDays: challenge.targetDays, timeZone: challenge.timeZone,
        durationMode: challenge.durationMode, dailyLimit: challenge.dailyLimit, status: challenge.status,
      };
    },
    joinStudent: (input) => studentSessions.join(input),
    resumeStudent: (token, challengeId) => studentSessions.resume(token, challengeId),
    getProgress(token, challengeId) {
      const resumed = studentSessions.resume(token, challengeId);
      if (resumed.status !== "authenticated") throw new Error("UNAUTHENTICATED");
      return resumed.progress;
    },
  });
}
