import type {
  Challenge,
  CompletionResult,
  StartAttemptInput,
  StartAttemptResult,
  SubmitCompletionInput,
} from "../../../src/shared/contracts";
import type { ExclusiveLock } from "../platform/lock";
import type { ChallengeRepository } from "../repositories/challenge-repository";
import type { CompletionRepository, CompletionRow } from "../repositories/completion-repository";
import type { AttemptClaims, AttemptTokenService } from "./attempt-token";

export class CompletionService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly completions: CompletionRepository,
    private readonly attempts: AttemptTokenService,
    private readonly lock: ExclusiveLock,
    private readonly now: () => Date,
    private readonly formatDate: (date: Date, timeZone: string) => string,
    private readonly createCompletionId: () => string,
  ) {}

  start(input: StartAttemptInput, studentId: string): StartAttemptResult {
    const challenge = this.requireChallenge(input.challengeId);
    if (challenge.durationMode !== "choice" && challenge.durationMode !== input.selectedDurationSec) {
      throw new Error("DURATION_NOT_ALLOWED");
    }
    const token = this.attempts.issue(studentId, challenge.challengeId, input.selectedDurationSec);
    return this.attempts.describe(token);
  }

  submit(input: SubmitCompletionInput, studentId: string): CompletionResult {
    return this.lock.runExclusive(() => {
      const prior = this.completions.findByIdempotencyKey(input.idempotencyKey);
      if (prior) return this.toResult(prior, this.requireChallenge(prior.challengeId));

      const challenge = this.requireChallenge(input.challengeId);
      const claims = this.attempts.verify(input.attemptToken);
      this.assertEligible(claims, input, studentId);
      const participationDate = this.formatDate(this.now(), challenge.timeZone);
      const acceptedToday = this.completions.listAcceptedByStudentDate(studentId, participationDate);
      const allToday = this.completions.listByStudent(studentId)
        .filter((row) => row.participationDate === participationDate);
      const stampGranted = acceptedToday.length < challenge.dailyLimit;
      const row: CompletionRow = {
        completionId: this.createCompletionId(), idempotencyKey: input.idempotencyKey,
        challengeId: challenge.challengeId, studentId, participationDate,
        attemptId: claims.attemptId, attemptIndex: allToday.length + 1,
        selectedDurationSec: claims.durationSec, elapsedSec: input.elapsedSec,
        faceDetectedSec: input.faceDetectedSec, cameraMode: input.cameraMode,
        completed: true, stampGranted, createdAt: this.now().toISOString(),
      };
      this.completions.insert(row);
      return this.toResult(row, challenge);
    });
  }

  private requireChallenge(challengeId: string): Challenge {
    const challenge = this.challenges.findById(challengeId);
    if (!challenge || challenge.status !== "active") throw new Error("CHALLENGE_NOT_ACTIVE");
    return challenge;
  }

  private assertEligible(claims: AttemptClaims, input: SubmitCompletionInput, studentId: string) {
    const nowMs = this.now().getTime();
    if (claims.studentId !== studentId || claims.challengeId !== input.challengeId) {
      throw new Error("ATTEMPT_OWNER_MISMATCH");
    }
    if (nowMs > claims.expiresAtMs) throw new Error("ATTEMPT_EXPIRED");
    if (claims.durationSec === "free" && input.elapsedSec > 300) {
      throw new Error("INVALID_FREE_DURATION");
    }
    if (input.faceDetectedSec !== null && input.faceDetectedSec > input.elapsedSec) {
      throw new Error("INVALID_FACE_DURATION");
    }
  }

  private toResult(row: CompletionRow, challenge: Challenge): CompletionResult {
    const acceptedDays = new Set(
      this.completions.listByStudent(row.studentId)
        .filter((completion) => completion.completed && completion.stampGranted)
        .map((completion) => completion.participationDate),
    ).size;
    return {
      completionId: row.completionId, challengeId: row.challengeId,
      participationDate: row.participationDate, acceptedDays,
      targetDays: challenge.targetDays, newlyAccepted: row.stampGranted,
    };
  }
}
