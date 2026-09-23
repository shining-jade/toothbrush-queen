import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { AttemptTokenService, type AttemptCrypto } from "../../apps-script/src/domain/attempt-token";
import { CompletionService } from "../../apps-script/src/domain/completion-service";
import type { ExclusiveLock } from "../../apps-script/src/platform/lock";
import { ChallengeRepository } from "../../apps-script/src/repositories/challenge-repository";
import { CompletionRepository } from "../../apps-script/src/repositories/completion-repository";
import { SubmitCompletionInputSchema } from "../../src/shared/contracts";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

class FakeClock {
  constructor(public value = new Date("2026-09-23T00:00:00.000Z")) {}
  now = () => new Date(this.value);
  advanceSeconds(seconds: number) { this.value = new Date(this.value.getTime() + seconds * 1000); }
  set(value: string) { this.value = new Date(value); }
}

class FakeLock implements ExclusiveLock {
  calls = 0;
  runExclusive<T>(operation: () => T) { this.calls += 1; return operation(); }
}

const attemptCrypto: AttemptCrypto = {
  encode: (value) => Buffer.from(value, "utf8").toString("base64url"),
  decode: (value) => Buffer.from(value, "base64url").toString("utf8"),
  sign: (value) => createHmac("sha256", "test-secret").update(value).digest("base64url"),
  safeEqual: (left, right) => left.length === right.length && left === right,
};

describe("CompletionService", () => {
  let clock: FakeClock;
  let memory: InMemorySheetGateway;
  let repository: CompletionRepository;
  let attempts: AttemptTokenService;
  let service: CompletionService;
  let attemptCounter: number;

  beforeEach(() => {
    clock = new FakeClock();
    memory = new InMemorySheetGateway();
    const challenges = new ChallengeRepository(memory);
    repository = new CompletionRepository(memory);
    challenges.insert({
      challengeId: "ABC123", name: "5일 양치왕", startDate: "2026-09-20",
      endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul",
      durationMode: 60, dailyLimit: 1, status: "active",
      createdAt: clock.now().toISOString(), updatedAt: clock.now().toISOString(),
    });
    attemptCounter = 0;
    attempts = new AttemptTokenService(attemptCrypto, () => clock.now().getTime(), () => `attempt-${++attemptCounter}`);
    service = new CompletionService(
      challenges, repository, attempts, new FakeLock(), clock.now,
      (date, timeZone) => new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(date),
      () => "completion-1",
    );
  });

  const input = (attemptToken: string, idempotencyKey = "97ab5a61-26eb-45fd-8fa2-5dc01fb1f5d6") => ({
    challengeId: "ABC123", attemptToken, idempotencyKey, elapsedSec: 60,
    faceDetectedSec: null, cameraMode: "timer-only" as const,
  });

  it("rejects completion before the signed duration elapses", () => {
    const attemptToken = attempts.issue("stu-1", "ABC123", 60);
    clock.advanceSeconds(59);
    expect(() => service.submit(input(attemptToken), "stu-1")).toThrow("ATTEMPT_TOO_EARLY");
  });

  it("returns one completion for two submissions with the same idempotency key", () => {
    const attemptToken = attempts.issue("stu-1", "ABC123", 60);
    clock.advanceSeconds(60);
    const first = service.submit(input(attemptToken), "stu-1");
    const second = service.submit(input(attemptToken), "stu-1");
    expect(second.completionId).toBe(first.completionId);
    expect(memory.readAll("Completions")).toHaveLength(1);
  });

  it("uses Asia/Seoul when UTC is still the prior date", () => {
    clock.set("2026-09-23T15:04:00.000Z");
    const attemptToken = attempts.issue("stu-1", "ABC123", 60);
    clock.set("2026-09-23T15:05:00.000Z");
    expect(service.submit(input(attemptToken), "stu-1").participationDate).toBe("2026-09-24");
  });

  it("records a second daily attempt without granting another accepted day", () => {
    const firstToken = attempts.issue("stu-1", "ABC123", 60);
    clock.advanceSeconds(60);
    const first = service.submit(input(firstToken), "stu-1");
    const secondToken = attempts.issue("stu-1", "ABC123", 60);
    clock.advanceSeconds(60);
    const second = service.submit(input(secondToken, "0fe903f8-48cf-4d3f-b244-9cd65f6cc98c"), "stu-1");
    expect(first.newlyAccepted).toBe(true);
    expect(second.newlyAccepted).toBe(false);
    expect(repository.listAcceptedByStudentDate("stu-1", second.participationDate)).toHaveLength(1);
  });

  it("does not accept a client localDate field", () => {
    const token = attempts.issue("stu-1", "ABC123", 60);
    expect(SubmitCompletionInputSchema.safeParse({ ...input(token), localDate: "2099-01-01" }).success).toBe(false);
  });
});
