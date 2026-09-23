import { describe, expect, it } from "vitest";

import { validateAdminSkinFile } from "@/features/admin/skin-upload/file-validation";

describe("validateAdminSkinFile", () => {
  it("rejects unsupported formats before reading them", async () => {
    const svg = new File(["<svg></svg>"], "skin.svg", { type: "image/svg+xml" });
    await expect(validateAdminSkinFile(svg)).rejects.toThrow("지원하지 않는 파일 형식이에요.");
  });

  it("rejects files larger than 2MB before decoding", async () => {
    const large = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    await expect(validateAdminSkinFile(large)).rejects.toThrow("2MB");
  });
});
