export interface AdminSessionStore {
  putSession(hash: string, ttlSeconds: number): void;
  hasSession(hash: string): boolean;
  getFailureCount(): number;
  recordFailure(ttlSeconds: number): void;
  clearFailures(): void;
}

const SESSION_PREFIX = "brush-king:admin-session:";
const FAILURE_KEY = "brush-king:admin-login-failures";

export class AppsScriptAdminSessionStore implements AdminSessionStore {
  private cache() { return CacheService.getScriptCache(); }

  putSession(hash: string, ttlSeconds: number) {
    this.cache().put(`${SESSION_PREFIX}${hash}`, "1", ttlSeconds);
  }

  hasSession(hash: string) {
    return this.cache().get(`${SESSION_PREFIX}${hash}`) === "1";
  }

  getFailureCount() {
    return Number(this.cache().get(FAILURE_KEY) ?? 0);
  }

  recordFailure(ttlSeconds: number) {
    this.cache().put(FAILURE_KEY, String(this.getFailureCount() + 1), ttlSeconds);
  }

  clearFailures() {
    this.cache().remove(FAILURE_KEY);
  }
}
