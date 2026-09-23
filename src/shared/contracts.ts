import { z } from "zod";

import type { BrushingMode } from "./brushing-mode";

export const BrushingModeSchema = z.union([
  z.literal(60),
  z.literal(180),
  z.literal("free"),
]) satisfies z.ZodType<BrushingMode>;

export const ChallengeIdSchema = z.string().regex(/^[A-Z0-9]{6,24}$/);
export const DeviceTokenSchema = z.string().min(20).max(256);

export const PublicSkinSchema = z.object({
  skinId: z.string().regex(/^skin-[a-z0-9-]{3,48}$/),
  name: z.string().trim().min(1).max(40),
  imageUrl: z.string().url().refine((url) => url.startsWith("https://")),
  anchorX: z.number().min(-1).max(1),
  anchorY: z.number().min(-1).max(1),
  scale: z.number().min(0.2).max(3),
  rotationOffset: z.number().min(-180).max(180),
  version: z.number().int().positive(),
  sortOrder: z.number().int().min(0).max(10_000),
}).strict();

export const AdminLoginInputSchema = z.object({
  password: z.string().min(8).max(256),
}).strict();
export const AdminLoginResultSchema = z.object({
  adminToken: z.string().min(32),
  expiresAtMs: z.number().int().positive(),
}).strict();
export const AdminSessionResultSchema = z.object({
  valid: z.literal(true),
  expiresAtMs: z.number().int().positive(),
}).strict();
export const AdminAssetUploadInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  fileName: z.string().trim().min(1).max(120),
  mimeType: z.enum(["image/png", "image/webp"]),
  byteSize: z.number().int().positive().max(2 * 1024 * 1024),
  base64: z.string().min(4),
}).strict();
export const AdminAssetUploadResultSchema = z.object({
  assetId: z.string().min(1).max(64),
  publicUrl: z.string().url(),
}).strict();
export const AdminSkinDraftSchema = z.object({
  assetId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  anchorX: z.number().min(-1).max(1),
  anchorY: z.number().min(-1).max(1),
  scale: z.number().min(0.2).max(3),
  rotationOffset: z.number().min(-180).max(180),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
}).strict();
export const AdminSkinSchema = PublicSkinSchema.extend({
  assetId: z.string().min(1).max(64),
  enabled: z.boolean(),
  updatedAt: z.string().datetime(),
}).strict();
export const AdminSkinListResultSchema = z.array(AdminSkinSchema).max(100);
export const AdminSkinEnabledInputSchema = z.object({
  skinId: PublicSkinSchema.shape.skinId,
  enabled: z.boolean(),
}).strict();

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
    skins: z.array(PublicSkinSchema).max(100).optional(),
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
    selectedDurationSec: BrushingModeSchema,
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
    durationSec: BrushingModeSchema,
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
      .object({
        deviceToken: DeviceTokenSchema.optional(),
        adminToken: z.string().min(32).max(256).optional(),
      })
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
export type PublicSkin = z.infer<typeof PublicSkinSchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;
export type AdminLoginResult = z.infer<typeof AdminLoginResultSchema>;
export type AdminAssetUploadInput = z.infer<typeof AdminAssetUploadInputSchema>;
export type AdminAssetUploadResult = z.infer<typeof AdminAssetUploadResultSchema>;
export type AdminSkinDraft = z.infer<typeof AdminSkinDraftSchema>;
export type AdminSkin = z.infer<typeof AdminSkinSchema>;
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
