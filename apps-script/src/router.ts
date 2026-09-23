import {
  AdminAssetUploadInputSchema,
  AdminLoginInputSchema,
  AdminSkinDraftSchema,
  AdminSkinEnabledInputSchema,
  ApiRequestSchema,
  ChallengeIdSchema,
  StartAttemptInputSchema,
  SubmitCompletionInputSchema,
  JoinStudentInputSchema,
  SessionResumeInputSchema,
  type ApiResponse,
  type Challenge,
  type JoinStudentResult,
  type CompletionResult,
  type ResumeStudentResult,
  type StartAttemptResult,
  type StudentProgress,
  type AdminAssetUploadResult,
  type AdminLoginResult,
  type AdminSkin,
} from "../../src/shared/contracts";
import { z } from "zod";
import { AdminAuthService } from "./domain/admin-auth-service";
import { AdminSkinService } from "./domain/admin-skin-service";
import { ProgressService } from "./domain/progress-service";
import { StudentSessionService } from "./domain/student-session-service";
import { AppsScriptAttemptCrypto, AttemptTokenService } from "./domain/attempt-token";
import { CompletionService } from "./domain/completion-service";
import { GoogleSheetGateway } from "./platform/google-sheet-gateway";
import { AppsScriptExclusiveLock } from "./platform/lock";
import { AppsScriptAdminSessionStore } from "./platform/admin-session-store";
import { AppsScriptSkinFileStore } from "./platform/skin-file-store";
import { AppsScriptSecurityProvider } from "./platform/security";
import { ChallengeRepository } from "./repositories/challenge-repository";
import { CompletionRepository } from "./repositories/completion-repository";
import { DeviceSessionRepository } from "./repositories/device-session-repository";
import { StudentRepository } from "./repositories/student-repository";
import { AssetRepository } from "./repositories/asset-repository";
import { SkinRepository } from "./repositories/skin-repository";

export type RouterServices = {
  getChallenge(challengeId: string): Challenge | null;
  joinStudent(input: Parameters<StudentSessionService["join"]>[0]): JoinStudentResult;
  resumeStudent(token: string, challengeId: string): ResumeStudentResult;
  getProgress(token: string, challengeId: string): StudentProgress;
  startBrushing(token: string, input: Parameters<CompletionService["start"]>[0]): StartAttemptResult;
  submitCompletion(token: string, input: Parameters<CompletionService["submit"]>[0]): CompletionResult;
  adminLogin(password: string): AdminLoginResult;
  getAdminSession(token: string): { valid: true; expiresAtMs: number };
  uploadAdminAsset(token: string, input: Parameters<AdminSkinService["uploadAsset"]>[1]): AdminAssetUploadResult;
  saveAdminSkin(token: string, input: Parameters<AdminSkinService["saveSkin"]>[1]): AdminSkin;
  listAdminSkins(token: string): AdminSkin[];
  setAdminSkinEnabled(token: string, skinId: string, enabled: boolean): AdminSkin;
};

const errorMessages: Record<string, string> = {
  ACTION_NOT_FOUND: "요청을 처리할 수 없습니다.",
  CHALLENGE_NOT_FOUND: "챌린지를 찾을 수 없습니다.",
  UNAUTHENTICATED: "인증이 필요합니다.",
  INVALID_REQUEST: "입력 내용을 확인해 주세요.",
  ADMIN_LOGIN_FAILED: "비밀번호를 확인해 주세요.",
  ADMIN_LOGIN_RATE_LIMITED: "로그인 시도가 너무 많아요. 10분 후 다시 시도해 주세요.",
  ADMIN_SESSION_EXPIRED: "관리자 로그인이 필요합니다.",
  INVALID_IMAGE_EXTENSION: "PNG 또는 WebP 파일을 선택해 주세요.",
  INVALID_IMAGE_SIZE: "이미지는 2MB 이하여야 합니다.",
  INVALID_IMAGE_SIGNATURE: "올바른 이미지 파일이 아닙니다.",
};

const EmptyObjectSchema = z.object({}).strict();
const knownErrors = new Set(Object.keys(errorMessages));

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
      if (request.action === "brushing.start") {
        return {
          ok: true,
          data: services.startBrushing(
            request.auth?.deviceToken ?? "",
            StartAttemptInputSchema.parse(request.payload),
          ),
        };
      }
      if (request.action === "completion.submit") {
        return {
          ok: true,
          data: services.submitCompletion(
            request.auth?.deviceToken ?? "",
            SubmitCompletionInputSchema.parse(request.payload),
          ),
        };
      }
      if (request.action === "admin.login") {
        const input = AdminLoginInputSchema.parse(request.payload);
        return { ok: true, data: services.adminLogin(input.password) };
      }
      if (request.action === "admin.session.get") {
        EmptyObjectSchema.parse(request.payload);
        return { ok: true, data: services.getAdminSession(request.auth?.adminToken ?? "") };
      }
      if (request.action === "admin.asset.upload") {
        return { ok: true, data: services.uploadAdminAsset(
          request.auth?.adminToken ?? "", AdminAssetUploadInputSchema.parse(request.payload),
        ) };
      }
      if (request.action === "admin.skin.save") {
        return { ok: true, data: services.saveAdminSkin(
          request.auth?.adminToken ?? "", AdminSkinDraftSchema.parse(request.payload),
        ) };
      }
      if (request.action === "admin.skin.list") {
        EmptyObjectSchema.parse(request.payload);
        return { ok: true, data: services.listAdminSkins(request.auth?.adminToken ?? "") };
      }
      if (request.action === "admin.skin.setEnabled") {
        const input = AdminSkinEnabledInputSchema.parse(request.payload);
        return { ok: true, data: services.setAdminSkinEnabled(
          request.auth?.adminToken ?? "", input.skinId, input.enabled,
        ) };
      }
      return failure("ACTION_NOT_FOUND");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = knownErrors.has(message) ? message : "INVALID_REQUEST";
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
  const assets = new AssetRepository(gateway);
  const skins = new SkinRepository(gateway, assets);
  const now = () => new Date();
  const progress = new ProgressService(
    challenges, students, completions, now,
    (date, timeZone) => Utilities.formatDate(date, timeZone, "yyyy-MM-dd"),
  );
  const studentSessions = new StudentSessionService(
    challenges, students, sessions, progress, new AppsScriptSecurityProvider(), now,
  );
  const secret = PropertiesService.getScriptProperties().getProperty("ATTEMPT_SIGNING_SECRET") ?? "";
  const security = new AppsScriptSecurityProvider();
  const properties = PropertiesService.getScriptProperties();
  const adminAuth = new AdminAuthService(
    security,
    new AppsScriptAdminSessionStore(),
    {
      salt: properties.getProperty("ADMIN_PASSWORD_SALT") ?? "",
      passwordHash: properties.getProperty("ADMIN_PASSWORD_HASH") ?? "",
    },
    () => now().getTime(),
  );
  const adminSkins = new AdminSkinService(
    adminAuth,
    (value) => Utilities.base64Decode(value).map((byte) => (byte + 256) % 256),
    new AppsScriptSkinFileStore(),
    assets,
    skins,
    new AppsScriptExclusiveLock(),
    security,
    now,
  );
  const attemptTokens = new AttemptTokenService(
    new AppsScriptAttemptCrypto(secret), () => now().getTime(),
    () => `attempt-${security.randomToken().slice(0, 24)}`,
  );
  const completionService = new CompletionService(
    challenges, completions, attemptTokens, new AppsScriptExclusiveLock(), now,
    (date, timeZone) => Utilities.formatDate(date, timeZone, "yyyy-MM-dd"),
    () => `cmp-${security.randomToken().slice(0, 24)}`,
  );
  const authenticatedStudentId = (token: string, challengeId: string) => {
    const resumed = studentSessions.resume(token, challengeId);
    if (resumed.status !== "authenticated") throw new Error("UNAUTHENTICATED");
    return resumed.progress.studentId;
  };
  return createRouter({
    getChallenge(challengeId) {
      const challenge = challenges.findById(ChallengeIdSchema.parse(challengeId));
      if (!challenge || challenge.status !== "active") return null;
      let publicSkins = [];
      try {
        publicSkins = skins.listEnabledPublic();
      } catch {
        publicSkins = [];
      }
      return {
        challengeId: challenge.challengeId, name: challenge.name, startDate: challenge.startDate,
        endDate: challenge.endDate, targetDays: challenge.targetDays, timeZone: challenge.timeZone,
        durationMode: challenge.durationMode, dailyLimit: challenge.dailyLimit, status: challenge.status,
        skins: publicSkins,
      };
    },
    joinStudent: (input) => studentSessions.join(input),
    resumeStudent: (token, challengeId) => studentSessions.resume(token, challengeId),
    getProgress(token, challengeId) {
      const resumed = studentSessions.resume(token, challengeId);
      if (resumed.status !== "authenticated") throw new Error("UNAUTHENTICATED");
      return resumed.progress;
    },
    startBrushing(token, input) {
      return completionService.start(input, authenticatedStudentId(token, input.challengeId));
    },
    submitCompletion(token, input) {
      return completionService.submit(input, authenticatedStudentId(token, input.challengeId));
    },
    adminLogin: (password) => adminAuth.login(password),
    getAdminSession(token) {
      adminAuth.requireSession(token);
      return { valid: true, expiresAtMs: now().getTime() + 4 * 60 * 60 * 1000 };
    },
    uploadAdminAsset: (token, input) => adminSkins.uploadAsset(token, input),
    saveAdminSkin: (token, input) => adminSkins.saveSkin(token, input),
    listAdminSkins: (token) => adminSkins.listSkins(token),
    setAdminSkinEnabled: (token, skinId, enabled) => adminSkins.setEnabled(token, skinId, enabled),
  });
}
