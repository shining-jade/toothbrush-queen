type AppsScriptTextOutput = {
  setMimeType(mimeType: string): AppsScriptTextOutput;
};

declare const ContentService: {
  MimeType: { JSON: string };
  createTextOutput(content: string): AppsScriptTextOutput;
};

function jsonResponse(payload: unknown) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost() {
  return jsonResponse({
    ok: false,
    error: { code: "NOT_IMPLEMENTED", message: "API route is not available." },
  });
}

(globalThis as typeof globalThis & { doPost: typeof doPost }).doPost = doPost;
