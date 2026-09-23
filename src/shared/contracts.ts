import { z } from "zod";

export const ChallengeIdSchema = z.string().regex(/^[A-Z0-9]{6,24}$/);
export const DeviceTokenSchema = z.string().min(20).max(256);

export const ChallengeSchema = z
  .object({
    challengeId: ChallengeIdSchema,
    name: z.string().trim().min(1).max(80),
    startDate: z.string().date(),
    endDate: z.string().date(),
    targetDays: z.number().int().min(1).max(365),
    timeZone: z.string().min(1).max(64),
    durationMode: z.union([z.literal(60), z.literal(180), z.literal("choice")]),
    dailyLimit: z.number().int().min(1).max(10),
    status: z.enum(["draft", "active", "ended"]),
  })
  .strict();

export const StudentProgressSchema = z
  .object({
    challengeId: ChallengeIdSchema,
    studentId: z.string().min(1).max(64),
    displayName: z.string().min(1).max(80),
    acceptedDays: z.number().int().min(0),
    targetDays: z.number().int().min(1),
    completedToday: z.boolean(),
  })
  .strict();

const identityField = z.string().trim().min(1).max(20);

export const JoinStudentInputSchema = z
  .object({
    challengeId: ChallengeIdSchema,
    grade: identityField,
    classNo: identityField,
    studentNo: identityField,
    name: z.string().trim().min(1).max(40),
  })
  .strict();

export const SessionResumeInputSchema = z
  .object({
    challengeId: ChallengeIdSchema,
  })
  .strict();

export const StartAttemptInputSchema = z
  .object({
    challengeId: ChallengeIdSchema,
    selectedDurationSec: z.union([z.literal(60), z.literal(180)]),
  })
  .strict();

export const SubmitCompletionInputSchema = z
  .object({
    challengeId: ChallengeIdSchema,
    attemptToken: z.string().min(20),
    idempotencyKey: z.string().uuid(),
    elapsedSec: z.number().int().min(0).max(3600),
    faceDetectedSec: z.number().min(0).max(3600).nullable(),
    cameraMode: z.enum(["camera", "timer-only"]),
  })
  .strict();

export const JoinStudentResultSchema = z
  .object({
    deviceToken: DeviceTokenSchema,
    progress: StudentProgressSchema,
  })
  .strict();

export const ResumeStudentResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unauthenticated") }).strict(),
  z
    .object({
      status: z.literal("authenticated"),
      progress: StudentProgressSchema,
    })
    .strict(),
]);

export const StartAttemptResultSchema = z
  .object({
    attemptId: z.string().min(1).max(64),
    attemptToken: z.string().min(20),
    durationSec: z.union([z.literal(60), z.literal(180)]),
    issuedAtMs: z.number().int().nonnegative(),
  })
  .strict();

export const CompletionResultSchema = z
  .object({
    completionId: z.string().min(1).max(64),
    challengeId: ChallengeIdSchema,
    participationDate: z.string().date(),
    acceptedDays: z.number().int().min(0),
    targetDays: z.number().int().min(1),
    newlyAccepted: z.boolean(),
  })
  .strict();

export const ApiRequestSchema = z
  .object({
    action: z.string().min(1).max(80),
    auth: z
      .object({ deviceToken: DeviceTokenSchema.optional() })
      .strict()
      .optional(),
    payload: z.unknown(),
  })
  .strict();

export const ApiResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown() }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({ code: z.string().min(1), message: z.string().min(1) })
        .strict(),
    })
    .strict(),
]);

export type Challenge = z.infer<typeof ChallengeSchema>;
export type StudentProgress = z.infer<typeof StudentProgressSchema>;
export type JoinStudentInput = z.infer<typeof JoinStudentInputSchema>;
export type SessionResumeInput = z.infer<typeof SessionResumeInputSchema>;
export type StartAttemptInput = z.infer<typeof StartAttemptInputSchema>;
export type SubmitCompletionInput = z.infer<typeof SubmitCompletionInputSchema>;
export type JoinStudentResult = z.infer<typeof JoinStudentResultSchema>;
export type ResumeStudentResult = z.infer<typeof ResumeStudentResultSchema>;
export type StartAttemptResult = z.infer<typeof StartAttemptResultSchema>;
export type CompletionResult = z.infer<typeof CompletionResultSchema>;
export type ApiRequest = z.infer<typeof ApiRequestSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
