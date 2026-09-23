import type { SheetGateway } from "../platform/sheet-gateway";
import type { BrushingMode } from "../../../src/shared/brushing-mode";

export type CompletionRow = {
  completionId: string; idempotencyKey: string; challengeId: string; studentId: string;
  participationDate: string; attemptId: string; attemptIndex: number;
  selectedDurationSec: BrushingMode; elapsedSec: number; faceDetectedSec: number | null;
  cameraMode: "camera" | "timer-only"; completed: boolean; stampGranted: boolean;
  reflection?: string; createdAt: string;
};

const toRow = (value: CompletionRow): unknown[] => [
  value.completionId, value.idempotencyKey, value.challengeId, value.studentId,
  value.participationDate, value.attemptId, value.attemptIndex, value.selectedDurationSec,
  value.elapsedSec, value.faceDetectedSec ?? "", value.cameraMode, value.completed,
  value.stampGranted, value.reflection ?? "", value.createdAt,
];
const parseStoredMode = (value: unknown): BrushingMode => {
  if (value === "free") return "free";
  const numeric = Number(value);
  if (numeric === 60 || numeric === 180) return numeric;
  throw new Error("INVALID_STORED_DURATION");
};
const toDateString = (value: unknown) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return String(value);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fromRow = (row: unknown[]): CompletionRow => ({
  completionId: String(row[0]), idempotencyKey: String(row[1]), challengeId: String(row[2]),
  studentId: String(row[3]), participationDate: toDateString(row[4]), attemptId: String(row[5]),
  attemptIndex: Number(row[6]), selectedDurationSec: parseStoredMode(row[7]),
  elapsedSec: Number(row[8]), faceDetectedSec: row[9] === "" ? null : Number(row[9]),
  cameraMode: String(row[10]) as CompletionRow["cameraMode"], completed: row[11] === true || row[11] === "TRUE",
  stampGranted: row[12] === true || row[12] === "TRUE", reflection: String(row[13] ?? ""),
  createdAt: String(row[14]),
});

export class CompletionRepository {
  constructor(private readonly gateway: SheetGateway) {}

  insert(value: CompletionRow) {
    this.gateway.append("Completions", toRow(value));
    return value;
  }

  findByIdempotencyKey(idempotencyKey: string) {
    const row = this.gateway.readAll("Completions").find((candidate) => String(candidate[1]) === idempotencyKey);
    return row ? fromRow(row) : null;
  }

  listByStudent(studentId: string) {
    return this.gateway.readAll("Completions").filter((row) => String(row[3]) === studentId).map(fromRow);
  }

  listByChallenge(challengeId: string) {
    return this.gateway.readAll("Completions")
      .filter((row) => String(row[2]) === challengeId)
      .map(fromRow);
  }

  listAcceptedByStudentDate(studentId: string, participationDate: string) {
    return this.listByStudent(studentId).filter((row) =>
      row.participationDate === participationDate && row.completed && row.stampGranted,
    );
  }

  deleteByStudent(studentId: string) {
    return this.gateway.deleteWhere("Completions", (row) => String(row[3]) === studentId);
  }

  updateReflection(completionId: string, reflection: string) {
    const rows = this.gateway.readAll("Completions");
    const dataIndex = rows.findIndex((row) => String(row[0]) === completionId);
    if (dataIndex < 0) throw new Error("COMPLETION_NOT_FOUND");
    const updated = { ...fromRow(rows[dataIndex]), reflection };
    this.gateway.update("Completions", dataIndex + 2, toRow(updated));
    return updated;
  }
}
