import type { SheetGateway } from "../platform/sheet-gateway";

export type AssetRow = {
  assetId: string;
  assetType: "skin";
  name: string;
  driveFileId: string;
  publicUrl: string;
  mimeType: "image/png" | "image/webp";
  byteSize: number;
  version: number;
  createdAt: string;
};

const toRow = (value: AssetRow): unknown[] => [
  value.assetId, value.assetType, value.name, value.driveFileId, value.publicUrl,
  value.mimeType, value.byteSize, value.version, value.createdAt,
];
const fromRow = (row: unknown[]): AssetRow => ({
  assetId: String(row[0]), assetType: "skin", name: String(row[2]),
  driveFileId: String(row[3]), publicUrl: String(row[4]),
  mimeType: String(row[5]) as AssetRow["mimeType"], byteSize: Number(row[6]),
  version: Number(row[7]), createdAt: String(row[8]),
});

export class AssetRepository {
  constructor(private readonly gateway: SheetGateway) {}

  insert(value: AssetRow) {
    this.gateway.append("Assets", toRow(value));
    return value;
  }

  findById(assetId: string) {
    const row = this.gateway.readAll("Assets").find((candidate) => String(candidate[0]) === assetId);
    return row ? fromRow(row) : null;
  }

  update(value: AssetRow) {
    const rows = this.gateway.readAll("Assets");
    const index = rows.findIndex((row) => String(row[0]) === value.assetId);
    if (index < 0) throw new Error("ASSET_NOT_FOUND");
    this.gateway.update("Assets", index + 2, toRow(value));
    return value;
  }
}
