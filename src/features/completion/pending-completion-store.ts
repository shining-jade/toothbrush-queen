import {
  SubmitCompletionInputSchema,
  type SubmitCompletionInput,
} from "@/shared/contracts";

export class PendingCompletionStore {
  constructor(
    private readonly storage: Storage | null =
      typeof window === "undefined" ? null : window.localStorage,
  ) {}

  save(input: SubmitCompletionInput): void {
    const validated = SubmitCompletionInputSchema.parse(input);
    this.storage?.setItem(this.key(validated.challengeId), JSON.stringify(validated));
  }

  load(challengeId: string): SubmitCompletionInput | null {
    const key = this.key(challengeId);
    const raw = this.storage?.getItem(key);
    if (!raw) return null;

    try {
      const parsed = SubmitCompletionInputSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || parsed.data.challengeId !== challengeId) {
        this.storage?.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      this.storage?.removeItem(key);
      return null;
    }
  }

  clear(challengeId: string): void {
    this.storage?.removeItem(this.key(challengeId));
  }

  private key(challengeId: string): string {
    return `brush-king:pending:${challengeId}`;
  }
}
