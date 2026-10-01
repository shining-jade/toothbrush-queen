type AppsScriptTextOutput = {
  setMimeType(mimeType: string): AppsScriptTextOutput;
};

import { createProductionRouter } from "./router";
import { installWizard } from "./setup/install-wizard";

declare const ContentService: {
  MimeType: { JSON: string };
  createTextOutput(content: string): AppsScriptTextOutput;
};

function jsonResponse(payload: unknown) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(event: GoogleAppsScript.Events.DoPost) {
  let request: unknown;
  try {
    request = JSON.parse(event.postData?.contents ?? "");
  } catch {
    request = null;
  }
  return jsonResponse(createProductionRouter()(request));
}

type InstallerGlobal = typeof globalThis & {
  __brushKingDoPost: typeof doPost;
  __brushKingInstallWizard: typeof installWizard;
};

const installerGlobal = globalThis as InstallerGlobal;
installerGlobal.__brushKingDoPost = doPost;
installerGlobal.__brushKingInstallWizard = installWizard;
