import { beforeEach, describe, expect, it } from "vitest";

import { LocalChallengeCache } from "@/lib/challenge-cache/local-challenge-cache";

const challenge = {
  challengeId: "ABC123",
  name: "양치의 여왕 챌린지",
  startDate: "2026-09-20",
  endDate: "2026-09-24",
  targetDays: 5,
  timeZone: "Asia/Seoul",
  durationMode: 60 as const,
  dailyLimit: 1,
  status: "active" as const,
};

describe("LocalChallengeCache", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns a valid cached challenge only during the five-minute freshness window", () => {
    let nowMs = 1_000;
    const cache = new LocalChallengeCache(window.localStorage, () => nowMs);

    cache.set(challenge);
    expect(cache.get("ABC123")).toEqual(challenge);

    nowMs += 5 * 60 * 1_000 + 1;
    expect(cache.get("ABC123")).toBeNull();
  });

  it("ignores malformed cached data", () => {
    window.localStorage.setItem("brush-king:challenge:ABC123", "not-json");

    expect(new LocalChallengeCache(window.localStorage).get("ABC123")).toBeNull();
  });
});
