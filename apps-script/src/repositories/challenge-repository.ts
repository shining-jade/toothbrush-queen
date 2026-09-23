import type { Challenge } from "../../../src/shared/contracts";
import type { SheetGateway } from "../platform/sheet-gateway";

export type ChallengeRow = Challenge & { createdAt: string; updatedAt: string };

const toRow = (value: ChallengeRow): unknown[] => [
  value.challengeId,
  value.name,
  value.startDate,
  value.endDate,
  value.targetDays,
  value.timeZone,
  value.durationMode,
  value.dailyLimit,
  value.status,
  value.createdAt,
  value.updatedAt,
];

const fromRow = (row: unknown[]): ChallengeRow => ({
  challengeId: String(row[0]),
  name: String(row[1]),
  startDate: String(row[2]),
  endDate: String(row[3]),
  targetDays: Number(row[4]),
  timeZone: String(row[5]),
  durationMode: row[6] === "choice" ? "choice" : (Number(row[6]) as 60 | 180),
  dailyLimit: Number(row[7]),
  status: String(row[8]) as ChallengeRow["status"],
  createdAt: String(row[9]),
  updatedAt: String(row[10]),
});

export class ChallengeRepository {
  constructor(private readonly gateway: SheetGateway) {}

  insert(value: ChallengeRow) {
    this.gateway.append("Challenges", toRow(value));
    return value;
  }

  findById(challengeId: string) {
    const row = this.gateway
      .readAll("Challenges")
      .find((candidate) => String(candidate[0]) === challengeId);
    return row ? fromRow(row) : null;
  }
}
