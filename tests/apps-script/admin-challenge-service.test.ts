import { describe, expect, it, vi } from "vitest";

import { AdminChallengeService } from "../../apps-script/src/domain/admin-challenge-service";
import { ChallengeRepository } from "../../apps-script/src/repositories/challenge-repository";
import { InMemorySheetGateway } from "./in-memory-sheet-gateway";

const initial = {
  challengeId: "ABC123", name: "5일 양치왕", startDate: "2026-09-20",
  endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul",
  durationMode: "choice" as const, dailyLimit: 1, status: "active" as const,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("AdminChallengeService", () => {
  it("updates the active challenge while preserving server-owned settings", () => {
    const repository = new ChallengeRepository(new InMemorySheetGateway());
    repository.insert(initial);
    const requireSession = vi.fn();
    const service = new AdminChallengeService(
      { requireSession }, repository, () => new Date("2026-09-23T00:00:00.000Z"),
    );

    const saved = service.save("admin-token", {
      challengeId: "ABC123", name: "10일 양치왕", startDate: "2026-10-01",
      endDate: "2026-10-14", targetDays: 10, durationMode: 180,
    });

    expect(requireSession).toHaveBeenCalledWith("admin-token");
    expect(saved).toMatchObject({
      name: "10일 양치왕", targetDays: 10, durationMode: 180,
      timeZone: "Asia/Seoul", dailyLimit: 1, status: "active",
    });
    expect(repository.findById("ABC123")).toMatchObject({
      name: "10일 양치왕", targetDays: 10, updatedAt: "2026-09-23T00:00:00.000Z",
    });
  });

  it("rejects an inverted period and a target longer than the calendar window", () => {
    const repository = new ChallengeRepository(new InMemorySheetGateway());
    repository.insert(initial);
    const service = new AdminChallengeService(
      { requireSession: vi.fn() }, repository, () => new Date(),
    );
    expect(() => service.save("token", {
      challengeId: "ABC123", name: "오류", startDate: "2026-10-10",
      endDate: "2026-10-01", targetDays: 5, durationMode: 60,
    })).toThrow("INVALID_CHALLENGE_PERIOD");
    expect(() => service.save("token", {
      challengeId: "ABC123", name: "오류", startDate: "2026-10-01",
      endDate: "2026-10-05", targetDays: 10, durationMode: 60,
    })).toThrow("TARGET_DAYS_EXCEED_PERIOD");
  });
});
