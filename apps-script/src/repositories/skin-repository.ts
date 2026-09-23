import { PublicSkinSchema, type PublicSkin } from "../../../src/shared/contracts";
import type { SheetGateway } from "../platform/sheet-gateway";
import type { AssetRepository } from "./asset-repository";

export type SkinRow = {
  skinId: string;
  assetId: string;
  anchorX: number;
  anchorY: number;
  scale: number;
  rotationOffset: number;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string;
};

const toRow = (value: SkinRow): unknown[] => [
  value.skinId, value.assetId, value.anchorX, value.anchorY, value.scale,
  value.rotationOffset, value.enabled, value.sortOrder, value.updatedAt,
];
const fromRow = (row: unknown[]): SkinRow => ({
  skinId: String(row[0]), assetId: String(row[1]), anchorX: Number(row[2]),
  anchorY: Number(row[3]), scale: Number(row[4]), rotationOffset: Number(row[5]),
  enabled: row[6] === true || row[6] === "TRUE", sortOrder: Number(row[7]),
  updatedAt: String(row[8]),
});

export class SkinRepository {
  constructor(
    private readonly gateway: SheetGateway,
    private readonly assets: AssetRepository,
  ) {}

  insert(value: SkinRow) {
    this.gateway.append("Skins", toRow(value));
    return value;
  }

  listAll() {
    return this.gateway.readAll("Skins").map(fromRow);
  }

  findById(skinId: string) {
    return this.listAll().find((skin) => skin.skinId === skinId) ?? null;
  }

  update(value: SkinRow) {
    const rows = this.gateway.readAll("Skins");
    const index = rows.findIndex((row) => String(row[0]) === value.skinId);
    if (index < 0) throw new Error("SKIN_NOT_FOUND");
    this.gateway.update("Skins", index + 2, toRow(value));
    return value;
  }

  listEnabledPublic(): PublicSkin[] {
    return this.listAll()
      .filter((skin) => skin.enabled)
      .map((skin) => {
        const asset = this.assets.findById(skin.assetId);
        if (!asset) return null;
        const parsed = PublicSkinSchema.safeParse({
          skinId: skin.skinId, name: asset.name, imageUrl: asset.publicUrl,
          anchorX: skin.anchorX, anchorY: skin.anchorY, scale: skin.scale,
          rotationOffset: skin.rotationOffset, version: asset.version,
          sortOrder: skin.sortOrder,
        });
        return parsed.success ? parsed.data : null;
      })
      .filter((skin): skin is PublicSkin => skin !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }
}
