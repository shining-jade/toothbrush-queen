import { PendingCompletionStore } from "@/features/completion/pending-completion-store";
import { ApiError } from "@/lib/api/api-error";
import {
  CompletionResultSchema,
  SubmitCompletionInputSchema,
  type CompletionResult,
  type SubmitCompletionInput,
} from "@/shared/contracts";

type CompletionApi = {
  submit: (
    input: SubmitCompletionInput,
    deviceToken: string,
  ) => Promise<CompletionResult>;
  refreshProgress: (challengeId: string, deviceToken: string) => Promise<unknown>;
};

export type CompletionOutcome =
  | { status: "submitted"; result: CompletionResult }
  | { status: "pending" }
  | { status: "authenticationRequired" };

export class CompletionService {
  constructor(
    private readonly api: CompletionApi,
    private readonly store: PendingCompletionStore,
    private readonly sessionStore: { clear: (challengeId: string) => void },
  ) {}

  async submitOrQueue(
    input: SubmitCompletionInput,
    deviceToken: string,
  ): Promise<CompletionOutcome> {
    const validated = SubmitCompletionInputSchema.parse(input);
    this.store.save(validated);
    return this.submitSaved(validated, deviceToken);
  }

  async retryPending(
    challengeId: string,
    deviceToken: string,
  ): Promise<CompletionOutcome> {
    const pending = this.store.load(challengeId);
    if (!pending) return { status: "pending" };
    return this.submitSaved(pending, deviceToken);
  }

  private async submitSaved(
    input: SubmitCompletionInput,
    deviceToken: string,
  ): Promise<CompletionOutcome> {
    try {
      const result = CompletionResultSchema.parse(
        await this.api.submit(input, deviceToken),
      );
      await this.api.refreshProgress(input.challengeId, deviceToken);
      this.store.clear(input.challengeId);
      return { status: "submitted", result };
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
        this.sessionStore.clear(input.challengeId);
        return { status: "authenticationRequired" };
      }
      if (error instanceof ApiError && error.code === "NETWORK_UNAVAILABLE") {
        return { status: "pending" };
      }
      throw error;
    }
  }
}
