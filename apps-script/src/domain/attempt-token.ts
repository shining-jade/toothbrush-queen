import type { StartAttemptResult } from "../../../src/shared/contracts";

export type AttemptClaims = {
  attemptId: string;
  studentId: string;
  challengeId: string;
  durationSec: 60 | 180;
  issuedAtMs: number;
  expiresAtMs: number;
};

export interface AttemptCrypto {
  encode(value: string): string;
  decode(value: string): string;
  sign(value: string): string;
  safeEqual(left: string, right: string): boolean;
}

const isClaims = (value: unknown): value is AttemptClaims => {
  if (!value || typeof value !== "object") return false;
  const claims = value as Record<string, unknown>;
  return typeof claims.attemptId === "string" && typeof claims.studentId === "string" &&
    typeof claims.challengeId === "string" && (claims.durationSec === 60 || claims.durationSec === 180) &&
    typeof claims.issuedAtMs === "number" && typeof claims.expiresAtMs === "number";
};

export class AttemptTokenService {
  constructor(
    private readonly crypto: AttemptCrypto,
    private readonly nowMs: () => number,
    private readonly createAttemptId: () => string,
  ) {}

  issue(studentId: string, challengeId: string, durationSec: 60 | 180) {
    const issuedAtMs = this.nowMs();
    const claims: AttemptClaims = {
      attemptId: this.createAttemptId(), studentId, challengeId, durationSec, issuedAtMs,
      expiresAtMs: issuedAtMs + durationSec * 1000 + 30 * 60 * 1000,
    };
    const payload = this.crypto.encode(JSON.stringify(claims));
    return `${payload}.${this.crypto.sign(payload)}`;
  }

  verify(token: string): AttemptClaims {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !this.crypto.safeEqual(signature, this.crypto.sign(payload))) {
      throw new Error("INVALID_ATTEMPT_TOKEN");
    }
    try {
      const claims: unknown = JSON.parse(this.crypto.decode(payload));
      if (!isClaims(claims)) throw new Error("INVALID_ATTEMPT_TOKEN");
      return claims;
    } catch {
      throw new Error("INVALID_ATTEMPT_TOKEN");
    }
  }

  describe(token: string): StartAttemptResult {
    const claims = this.verify(token);
    return {
      attemptId: claims.attemptId, attemptToken: token,
      durationSec: claims.durationSec, issuedAtMs: claims.issuedAtMs,
    };
  }
}

const stripPadding = (value: string) => value.replace(/=+$/u, "");

export class AppsScriptAttemptCrypto implements AttemptCrypto {
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error("ATTEMPT_SIGNING_SECRET_INVALID");
  }

  encode(value: string) {
    return stripPadding(Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8));
  }

  decode(value: string) {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(value)).getDataAsString();
  }

  sign(value: string) {
    return stripPadding(Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(value, this.secret),
    ));
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
