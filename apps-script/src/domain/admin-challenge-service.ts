import {
  AdminChallengeSaveInputSchema,
  ChallengeSchema,
  type AdminChallengeSaveInput,
  type Challenge,
} from "../../../src/shared/contracts";
import type { ChallengeRepository } from "../repositories/challenge-repository";
import type { AdminAuthService } from "./admin-auth-service";

const DAY_MS = 24 * 60 * 60 * 1000;

export class AdminChallengeService {
  constructor(
    private readonly auth: Pick<AdminAuthService, "requireSession">,
    private readonly challenges: ChallengeRepository,
    private readonly now: () => Date,
  ) {}

  save(adminToken: string, rawInput: AdminChallengeSaveInput): Challenge {
    this.auth.requireSession(adminToken);
    const input = AdminChallengeSaveInputSchema.parse(rawInput);
    const startMs = Date.parse(`${input.startDate}T00:00:00.000Z`);
    const endMs = Date.parse(`${input.endDate}T00:00:00.000Z`);
    if (endMs < startMs) throw new Error("INVALID_CHALLENGE_PERIOD");
    const calendarDays = Math.floor((endMs - startMs) / DAY_MS) + 1;
    if (input.targetDays > calendarDays) throw new Error("TARGET_DAYS_EXCEED_PERIOD");
    const existing = this.challenges.findById(input.challengeId);
    if (!existing || existing.status !== "active") throw new Error("CHALLENGE_NOT_EDITABLE");
    const saved = this.challenges.update({
      ...existing,
      ...input,
      updatedAt: this.now().toISOString(),
    });
    return ChallengeSchema.parse({
      challengeId: saved.challengeId,
      name: saved.name,
      startDate: saved.startDate,
      endDate: saved.endDate,
      targetDays: saved.targetDays,
      timeZone: saved.timeZone,
      durationMode: saved.durationMode,
      dailyLimit: saved.dailyLimit,
      status: saved.status,
    });
  }
}
