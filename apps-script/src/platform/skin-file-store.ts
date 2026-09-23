import type { ValidatedImage } from "../domain/image-upload";

export type StoredSkinFile = { driveFileId: string; publicUrl: string };

export interface SkinFileStore {
  create(image: ValidatedImage): StoredSkinFile;
  trash(driveFileId: string): void;
}

export class AppsScriptSkinFileStore implements SkinFileStore {
  private folder() {
    const folderId = PropertiesService.getScriptProperties().getProperty("SKIN_ASSET_FOLDER_ID");
    if (!folderId) throw new Error("SKIN_ASSET_FOLDER_ID_MISSING");
    return DriveApp.getFolderById(folderId);
  }

  create(image: ValidatedImage): StoredSkinFile {
    const signedBytes = image.bytes.map((byte) => byte > 127 ? byte - 256 : byte);
    const blob = Utilities.newBlob(signedBytes, image.mimeType, image.fileName);
    const file = this.folder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const driveFileId = file.getId();
    return {
      driveFileId,
      publicUrl: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveFileId)}`,
    };
  }

  trash(driveFileId: string) {
    DriveApp.getFileById(driveFileId).setTrashed(true);
  }
}
