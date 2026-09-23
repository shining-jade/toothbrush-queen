import type { SheetGateway } from "../platform/sheet-gateway";

export type DeviceSessionRow = {
  tokenHash: string; studentId: string; challengeId: string; createdAt: string;
  expiresAt: string; lastUsedAt: string; revokedAt: string;
};

const toRow = (value: DeviceSessionRow): unknown[] => [
  value.tokenHash, value.studentId, value.challengeId, value.createdAt,
  value.expiresAt, value.lastUsedAt, value.revokedAt,
];
const fromRow = (row: unknown[]): DeviceSessionRow => ({
  tokenHash: String(row[0]), studentId: String(row[1]), challengeId: String(row[2]),
  createdAt: String(row[3]), expiresAt: String(row[4]), lastUsedAt: String(row[5]), revokedAt: String(row[6]),
});

export class DeviceSessionRepository {
  constructor(private readonly gateway: SheetGateway) {}

  insert(value: DeviceSessionRow) {
    this.gateway.append("DeviceSessions", toRow(value));
    return value;
  }

  findByTokenHash(tokenHash: string) {
    const row = this.gateway.readAll("DeviceSessions").find((candidate) => String(candidate[0]) === tokenHash);
    return row ? fromRow(row) : null;
  }
}
