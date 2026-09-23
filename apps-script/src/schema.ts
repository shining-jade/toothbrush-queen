export const SHEET_SCHEMAS = {
  Challenges: [
    "challengeId",
    "name",
    "startDate",
    "endDate",
    "targetDays",
    "timeZone",
    "durationMode",
    "dailyLimit",
    "status",
    "createdAt",
    "updatedAt",
  ],
  Students: [
    "studentId",
    "challengeId",
    "grade",
    "classNo",
    "studentNo",
    "name",
    "createdAt",
    "updatedAt",
    "status",
  ],
  DeviceSessions: [
    "tokenHash",
    "studentId",
    "challengeId",
    "createdAt",
    "expiresAt",
    "lastUsedAt",
    "revokedAt",
  ],
  Completions: [
    "completionId",
    "idempotencyKey",
    "challengeId",
    "studentId",
    "participationDate",
    "attemptId",
    "attemptIndex",
    "selectedDurationSec",
    "elapsedSec",
    "faceDetectedSec",
    "cameraMode",
    "completed",
    "stampGranted",
    "createdAt",
  ],
  Assets: [
    "assetId", "assetType", "name", "driveFileId", "publicUrl", "mimeType",
    "byteSize", "version", "createdAt",
  ],
  Skins: [
    "skinId", "assetId", "anchorX", "anchorY", "scale", "rotationOffset",
    "enabled", "sortOrder", "updatedAt",
  ],
} as const;

export type SheetTab = keyof typeof SHEET_SCHEMAS;

export function assertSheetHeaders(tab: SheetTab, actualHeaders: unknown[]) {
  const expected = SHEET_SCHEMAS[tab];
  const matches =
    actualHeaders.length === expected.length &&
    expected.every((header, index) => actualHeaders[index] === header);
  if (!matches) throw new Error(`SHEET_SCHEMA_MISMATCH:${tab}`);
}
