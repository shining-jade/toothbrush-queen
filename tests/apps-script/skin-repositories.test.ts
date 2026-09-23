import { describe, expect, it } from "vitest";

import { AssetRepository } from "../../apps-script/src/repositories/asset-repository";
import { SkinRepository } from "../../apps-script/src/repositories/skin-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

describe("skin repositories", () => {
  it("joins enabled skin calibration with public asset metadata", () => {
    const memory = new InMemorySheetGateway();
    const assets = new AssetRepository(memory);
    const skins = new SkinRepository(memory, assets);
    assets.insert({
      assetId: "asset-1", assetType: "skin", name: "꽃님 사진관",
      driveFileId: "drive-1", publicUrl: "https://drive.google.com/uc?id=drive-1",
      mimeType: "image/png", byteSize: 8, version: 1,
      createdAt: "2026-09-23T00:00:00.000Z",
    });
    skins.insert({
      skinId: "skin-flower-1", assetId: "asset-1", anchorX: 0, anchorY: -0.4,
      scale: 1.4, rotationOffset: 0, enabled: true, sortOrder: 10,
      updatedAt: "2026-09-23T00:00:00.000Z",
    });

    expect(skins.listEnabledPublic()).toEqual([expect.objectContaining({
      skinId: "skin-flower-1", name: "꽃님 사진관", version: 1,
    })]);
  });

  it("omits disabled and malformed public rows without breaking valid skins", () => {
    const memory = new InMemorySheetGateway();
    const assets = new AssetRepository(memory);
    const skins = new SkinRepository(memory, assets);
    assets.insert({ assetId: "asset-1", assetType: "skin", name: "good", driveFileId: "d1", publicUrl: "https://example.com/good.png", mimeType: "image/png", byteSize: 8, version: 1, createdAt: "2026-09-23T00:00:00.000Z" });
    skins.insert({ skinId: "skin-good-1", assetId: "asset-1", anchorX: 0, anchorY: 0, scale: 1, rotationOffset: 0, enabled: true, sortOrder: 1, updatedAt: "2026-09-23T00:00:00.000Z" });
    skins.insert({ skinId: "skin-hidden-1", assetId: "asset-1", anchorX: 0, anchorY: 0, scale: 1, rotationOffset: 0, enabled: false, sortOrder: 2, updatedAt: "2026-09-23T00:00:00.000Z" });
    skins.insert({ skinId: "skin-bad-1", assetId: "asset-1", anchorX: 0, anchorY: 0, scale: 9, rotationOffset: 0, enabled: true, sortOrder: 3, updatedAt: "2026-09-23T00:00:00.000Z" });

    expect(skins.listEnabledPublic().map((skin) => skin.skinId)).toEqual(["skin-good-1"]);
  });
});
