import type { AdminAssetUploadInput } from "../../../src/shared/contracts";

export type ValidatedImage = AdminAssetUploadInput & { bytes: number[] };
export type Base64Decoder = (value: string) => number[];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ascii = (bytes: number[], start: number, end: number) =>
  bytes.slice(start, end).map((byte) => String.fromCharCode(byte)).join("");
const startsWith = (bytes: number[], signature: number[]) =>
  signature.every((byte, index) => bytes[index] === byte);

export function decodeAndValidateImage(
  input: AdminAssetUploadInput,
  decodeBase64: Base64Decoder,
): ValidatedImage {
  const extension = input.fileName.toLowerCase().split(".").pop();
  const expectedExtension = input.mimeType === "image/png" ? "png" : "webp";
  if (extension !== expectedExtension) throw new Error("INVALID_IMAGE_EXTENSION");

  const bytes = decodeBase64(input.base64);
  if (
    input.byteSize !== bytes.length ||
    bytes.length === 0 ||
    bytes.length > 2 * 1024 * 1024
  ) throw new Error("INVALID_IMAGE_SIZE");

  const isPng = startsWith(bytes, PNG_SIGNATURE);
  const isWebP = ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  if (
    (input.mimeType === "image/png" && !isPng) ||
    (input.mimeType === "image/webp" && !isWebP)
  ) throw new Error("INVALID_IMAGE_SIGNATURE");

  return { ...input, bytes };
}
