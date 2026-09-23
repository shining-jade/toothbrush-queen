import { describe, expect, it } from "vitest";

import { decodeAndValidateImage } from "../../apps-script/src/domain/image-upload";

const decode = (value: string) => [...Buffer.from(value, "base64")];

describe("image upload validation", () => {
  it("accepts a PNG whose MIME, extension, size, and signature agree", () => {
    const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(decodeAndValidateImage({
      name: "cat", fileName: "cat.png", mimeType: "image/png",
      byteSize: bytes.length, base64: Buffer.from(bytes).toString("base64"),
    }, decode)).toMatchObject({ mimeType: "image/png", bytes });
  });

  it("rejects a fake PNG before storage", () => {
    expect(() => decodeAndValidateImage({
      name: "fake", fileName: "fake.png", mimeType: "image/png", byteSize: 4,
      base64: Buffer.from("<svg").toString("base64"),
    }, decode)).toThrow("INVALID_IMAGE_SIGNATURE");
  });

  it("rejects mismatched extensions and decoded sizes over 2 MiB", () => {
    const webp = Buffer.from("RIFF0000WEBP");
    expect(() => decodeAndValidateImage({
      name: "wrong", fileName: "wrong.png", mimeType: "image/webp",
      byteSize: webp.length, base64: webp.toString("base64"),
    }, decode)).toThrow("INVALID_IMAGE_EXTENSION");
    expect(() => decodeAndValidateImage({
      name: "large", fileName: "large.webp", mimeType: "image/webp",
      byteSize: 2 * 1024 * 1024 + 1, base64: webp.toString("base64"),
    }, decode)).toThrow("INVALID_IMAGE_SIZE");
  });
});
