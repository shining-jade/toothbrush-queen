export interface SecurityProvider {
  randomToken(): string;
  sha256(value: string): string;
  safeEqual(left: string, right: string): boolean;
}

const bytesToHex = (bytes: number[]) =>
  bytes.map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");

export class AppsScriptSecurityProvider implements SecurityProvider {
  randomToken() {
    return `${Utilities.getUuid()}${Utilities.getUuid()}`.replaceAll("-", "");
  }

  sha256(value: string) {
    return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value));
  }

  safeEqual(left: string, right: string) {
    let difference = left.length ^ right.length;
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
    }
    return difference === 0;
  }
}
