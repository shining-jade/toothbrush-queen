import {
  AdminSkinSchema,
  type AdminAssetUploadInput,
  type AdminAssetUploadResult,
  type AdminSkin,
  type AdminSkinDraft,
} from "../../../src/shared/contracts";
import type { ExclusiveLock } from "../platform/lock";
import type { SkinFileStore } from "../platform/skin-file-store";
import type { SecurityProvider } from "../platform/security";
import type { AssetRepository } from "../repositories/asset-repository";
import type { SkinRepository, SkinRow } from "../repositories/skin-repository";
import type { AdminAuthService } from "./admin-auth-service";
import { decodeAndValidateImage, type Base64Decoder } from "./image-upload";

export class AdminSkinService {
  constructor(
    private readonly auth: Pick<AdminAuthService, "requireSession">,
    private readonly decodeBase64: Base64Decoder,
    private readonly files: SkinFileStore,
    private readonly assets: AssetRepository,
    private readonly skins: SkinRepository,
    private readonly lock: ExclusiveLock,
    private readonly security: SecurityProvider,
    private readonly now: () => Date,
  ) {}

  uploadAsset(adminToken: string, input: AdminAssetUploadInput): AdminAssetUploadResult {
    this.auth.requireSession(adminToken);
    return this.lock.runExclusive(() => {
      const image = decodeAndValidateImage(input, this.decodeBase64);
      const stored = this.files.create(image);
      try {
        const assetId = `asset-${this.security.randomToken().slice(0, 24).toLowerCase()}`;
        const asset = this.assets.insert({
          assetId, assetType: "skin", name: input.name,
          driveFileId: stored.driveFileId, publicUrl: stored.publicUrl,
          mimeType: input.mimeType, byteSize: image.bytes.length, version: 1,
          createdAt: this.now().toISOString(),
        });
        return { assetId: asset.assetId, publicUrl: asset.publicUrl };
      } catch (error) {
        this.files.trash(stored.driveFileId);
        throw error;
      }
    });
  }

  saveSkin(adminToken: string, draft: AdminSkinDraft): AdminSkin {
    this.auth.requireSession(adminToken);
    return this.lock.runExclusive(() => {
      const asset = this.assets.findById(draft.assetId);
      if (!asset) throw new Error("ASSET_NOT_FOUND");
      if (asset.name !== draft.name) this.assets.update({ ...asset, name: draft.name });
      const skinId = draft.skinId ?? `skin-${this.security.randomToken().slice(0, 24).toLowerCase()}`;
      const value: SkinRow = {
        skinId, assetId: draft.assetId, anchorX: draft.anchorX, anchorY: draft.anchorY,
        scale: draft.scale, rotationOffset: draft.rotationOffset, enabled: draft.enabled,
        sortOrder: draft.sortOrder, updatedAt: this.now().toISOString(),
      };
      const stored = this.skins.findById(skinId) ? this.skins.update(value) : this.skins.insert(value);
      return this.toAdminSkin(stored);
    });
  }

  listSkins(adminToken: string) {
    this.auth.requireSession(adminToken);
    return this.skins.listAll().map((skin) => this.toAdminSkin(skin));
  }

  setEnabled(adminToken: string, skinId: string, enabled: boolean) {
    this.auth.requireSession(adminToken);
    return this.lock.runExclusive(() => {
      const skin = this.skins.findById(skinId);
      if (!skin) throw new Error("SKIN_NOT_FOUND");
      return this.toAdminSkin(this.skins.update({
        ...skin, enabled, updatedAt: this.now().toISOString(),
      }));
    });
  }

  private toAdminSkin(skin: SkinRow): AdminSkin {
    const asset = this.assets.findById(skin.assetId);
    if (!asset) throw new Error("ASSET_NOT_FOUND");
    return AdminSkinSchema.parse({
      skinId: skin.skinId, assetId: skin.assetId, name: asset.name,
      imageUrl: asset.publicUrl, anchorX: skin.anchorX, anchorY: skin.anchorY,
      scale: skin.scale, rotationOffset: skin.rotationOffset, version: asset.version,
      sortOrder: skin.sortOrder, enabled: skin.enabled, updatedAt: skin.updatedAt,
    });
  }
}
