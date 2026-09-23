import type { SheetGateway } from "../platform/sheet-gateway";

export type CompletionRow = {
  completionId: string; idempotencyKey: string; challengeId: string; studentId: string;
  participationDate: string; attemptId: string; attemptIndex: number;
  selectedDurationSec: 60 | 180; elapsedSec: number; faceDetectedSec: number | null;
  cameraMode: "camera" | "timer-only"; completed: boolean; stampGranted: boolean; createdAt: string;
};

const toRow = (value: CompletionRow): unknown[] => [
  value.completionId, value.idempotencyKey, value.challengeId, value.studentId,
  value.participationDate, value.attemptId, value.attemptIndex, value.selectedDurationSec,
  value.elapsedSec, value.faceDetectedSec ?? "", value.cameraMode, value.completed,
  value.stampGranted, value.createdAt,
];
const fromRow = (row: unknown[]): CompletionRow => ({
  completionId: String(row[0]), idempotencyKey: String(row[1]), challengeId: String(row[2]),
  studentId: String(row[3]), participationDate: String(row[4]), attemptId: String(row[5]),
  attemptIndex: Number(row[6]), selectedDurationSec: Number(row[7]) as 60 | 180,
  elapsedSec: Number(row[8]), faceDetectedSec: row[9] === "" ? null : Number(row[9]),
  cameraMode: String(row[10]) as CompletionRow["cameraMode"], completed: row[11] === true || row[11] === "TRUE",
  stampGranted: row[12] === true || row[12] === "TRUE", createdAt: String(row[13]),
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

  listAcceptedByStudentDate(studentId: string, participationDate: string) {
    return this.listByStudent(studentId).filter((row) =>
      row.participationDate === participationDate && row.completed && row.stampGranted,
    );
  }
}
