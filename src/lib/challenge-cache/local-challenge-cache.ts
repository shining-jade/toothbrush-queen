import { ChallengeSchema, type Challenge } from "@/shared/contracts";

const CACHE_PREFIX = "brush-king:challenge:";
const FRESHNESS_MS = 5 * 60 * 1_000;

type CachedChallenge = {
  cachedAtMs: number;
  challenge: Challenge;
};

export type ChallengeCache = {
  get: (challengeId: string) => Challenge | null;
  set: (challenge: Challenge) => void;
};

export class LocalChallengeCache implements ChallengeCache {
  constructor(
    private readonly storage: Storage | null,
    private readonly nowMs: () => number = Date.now,
  ) {}

  get(challengeId: string): Challenge | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(`${CACHE_PREFIX}${challengeId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CachedChallenge>;
      if (
        typeof parsed.cachedAtMs !== "number"
        || this.nowMs() - parsed.cachedAtMs > FRESHNESS_MS
        || this.nowMs() < parsed.cachedAtMs
      ) return null;
      const challenge = ChallengeSchema.safeParse(parsed.challenge);
      return challenge.success && challenge.data.challengeId === challengeId
        ? challenge.data
        : null;
    } catch {
      return null;
    }
  }

  set(challenge: Challenge) {
    if (!this.storage) return;
    try {
      this.storage.setItem(`${CACHE_PREFIX}${challenge.challengeId}`, JSON.stringify({
        cachedAtMs: this.nowMs(),
        challenge,
      } satisfies CachedChallenge));
    } catch {
      // Storage can be unavailable in private browsing; network loading still works.
    }
  }
}
