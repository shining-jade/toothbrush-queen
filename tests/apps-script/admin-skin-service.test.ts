import { describe, expect, it, vi } from "vitest";

import { AdminSkinService } from "../../apps-script/src/domain/admin-skin-service";
import { AssetRepository } from "../../apps-script/src/repositories/asset-repository";
import { SkinRepository } from "../../apps-script/src/repositories/skin-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const input = {
  name: "꽃님 사진관", fileName: "flower.png", mimeType: "image/png" as const,
  byteSize: png.length, base64: Buffer.from(png).toString("base64"),
};

function fixture(gateway = new InMemorySheetGateway()) {
  const assets = new AssetRepository(gateway);
  const skins = new SkinRepository(gateway, assets);
  const files = {
    create: vi.fn(() => ({ driveFileId: "drive-file-1", publicUrl: "https://example.com/flower.png" })),
    trash: vi.fn(),
  };
  const service = new AdminSkinService(
    { requireSession: vi.fn((token: string) => { if (token !== "valid-admin-token") throw new Error("ADMIN_SESSION_EXPIRED"); }) },
    (value) => [...Buffer.from(value, "base64")], files, assets, skins,
    { runExclusive: <T>(operation: () => T) => operation() },
    { randomToken: () => "flower-1", sha256: (value: string) => value, safeEqual: (a: string, b: string) => a === b },
    () => new Date("2026-09-23T00:00:00.000Z"),
  );
  return { service, files };
}

describe("AdminSkinService", () => {
  it("uploads an asset and saves an active calibrated skin", () => {
    const { service } = fixture();
    const asset = service.uploadAsset("valid-admin-token", input);
    const skin = service.saveSkin("valid-admin-token", {
      assetId: asset.assetId, name: "꽃님 사진관", anchorX: 0, anchorY: -0.4,
      scale: 1.4, rotationOffset: 0, enabled: true, sortOrder: 10,
    });
    expect(service.listSkins("valid-admin-token")).toEqual([
      expect.objectContaining({ skinId: skin.skinId, enabled: true, imageUrl: asset.publicUrl }),
    ]);
  });

  it("trashes a new Drive file when asset metadata storage fails", () => {
    const gateway = new InMemorySheetGateway();
    gateway.failNextAppend("Assets", new Error("SHEET_WRITE_FAILED"));
    const { service, files } = fixture(gateway);
    expect(() => service.uploadAsset("valid-admin-token", input)).toThrow("SHEET_WRITE_FAILED");
    expect(files.trash).toHaveBeenCalledWith("drive-file-1");
  });

  it("rejects missing sessions before touching Drive", () => {
    const { service, files } = fixture();
    expect(() => service.uploadAsset("expired", input)).toThrow("ADMIN_SESSION_EXPIRED");
    expect(files.create).not.toHaveBeenCalled();
  });
});
