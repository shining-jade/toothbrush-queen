const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ValidatedBrowserFile = {
  fileName: string;
  mimeType: "image/png" | "image/webp";
  byteSize: number;
  base64: string;
  previewUrl: string;
};

const supportedTypes = new Map([
  ["image/png", ".png"],
  ["image/webp", ".webp"],
] as const);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function decodeImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("이미지 파일을 확인해 주세요."));
    image.src = url;
  });
}

export async function validateAdminSkinFile(
  file: File,
  decode: (url: string) => Promise<void> = decodeImage,
): Promise<ValidatedBrowserFile> {
  const extension = supportedTypes.get(file.type as "image/png" | "image/webp");
  if (!extension || !file.name.toLowerCase().endsWith(extension)) {
    throw new Error("지원하지 않는 파일 형식이에요.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("이미지는 2MB 이하로 올려 주세요.");
  }

  const previewUrl = await readAsDataUrl(file);
  await decode(previewUrl);
  const separator = previewUrl.indexOf(",");
  if (separator < 0) throw new Error("이미지 파일을 확인해 주세요.");

  return {
    fileName: file.name,
    mimeType: file.type as "image/png" | "image/webp",
    byteSize: file.size,
    base64: previewUrl.slice(separator + 1),
    previewUrl,
  };
}
