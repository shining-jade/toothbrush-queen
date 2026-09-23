import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  AttemptTokenService,
  type AttemptCrypto,
} from "../../apps-script/src/domain/attempt-token";

const cryptoAdapter: AttemptCrypto = {
  encode: (value) => Buffer.from(value, "utf8").toString("base64url"),
  decode: (value) => Buffer.from(value, "base64url").toString("utf8"),
  sign: (value) => createHmac("sha256", "test-secret").update(value).digest("base64url"),
  safeEqual: (left, right) => left.length === right.length && left === right,
};

describe("AttemptTokenService", () => {
  it("round-trips signed claims", () => {
    const service = new AttemptTokenService(cryptoAdapter, () => 1_000, () => "attempt-1");
    const token = service.issue("stu-1", "ABC123", 60);
    expect(service.verify(token)).toEqual({
      attemptId: "attempt-1", studentId: "stu-1", challengeId: "ABC123",
      durationSec: 60, issuedAtMs: 1_000, expiresAtMs: 1_861_000,
    });
  });

  it("rejects a tampered payload", () => {
    const service = new AttemptTokenService(cryptoAdapter, () => 1_000, () => "attempt-1");
    const [payload, signature] = service.issue("stu-1", "ABC123", 60).split(".");
    expect(() => service.verify(`${payload}x.${signature}`)).toThrow("INVALID_ATTEMPT_TOKEN");
  });
});
