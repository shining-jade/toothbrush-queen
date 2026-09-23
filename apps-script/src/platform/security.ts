export interface SecurityProvider {
  randomToken(): string;
  sha256(value: string): string;
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
}
