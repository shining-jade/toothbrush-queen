import { ApiError } from "@/lib/api/api-error";

const DEVICE_TOKEN_MIN_LENGTH = 20;

export class DeviceSessionStore {
  constructor(
    private readonly storage: Storage | null =
      typeof window === "undefined" ? null : window.localStorage,
  ) {}

  get(challengeId: string): string | null {
    const key = this.key(challengeId);
    const token = this.storage?.getItem(key) ?? null;

    if (token !== null && token.length < DEVICE_TOKEN_MIN_LENGTH) {
      this.storage?.removeItem(key);
      return null;
    }

    return token;
  }

  set(challengeId: string, deviceToken: string): void {
    if (deviceToken.length < DEVICE_TOKEN_MIN_LENGTH) {
      throw new Error("기기 토큰 형식이 올바르지 않습니다.");
    }

    this.storage?.setItem(this.key(challengeId), deviceToken);
  }

  clear(challengeId: string): void {
    this.storage?.removeItem(this.key(challengeId));
  }

  private key(challengeId: string): string {
    return `brush-king:session:${challengeId}`;
  }
}

export function recoverFromAuthenticationError(
  error: unknown,
  challengeId: string,
  store: DeviceSessionStore,
): boolean {
  if (!(error instanceof ApiError) || error.code !== "UNAUTHENTICATED") {
    return false;
  }

  store.clear(challengeId);
  return true;
}
