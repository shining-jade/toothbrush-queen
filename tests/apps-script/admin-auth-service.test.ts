import { describe, expect, it } from "vitest";

import { AdminAuthService } from "../../apps-script/src/domain/admin-auth-service";
import type { AdminSessionStore } from "../../apps-script/src/platform/admin-session-store";
import type { SecurityProvider } from "../../apps-script/src/platform/security";

class MemoryAdminStore implements AdminSessionStore {
  sessions = new Map<string, number>();
  failures = 0;
  sessionTtl = 0;
  constructor(private readonly now: () => number) {}
  putSession(hash: string, ttlSeconds: number) {
    this.sessionTtl = ttlSeconds;
    this.sessions.set(hash, this.now() + ttlSeconds * 1000);
  }
  hasSession(hash: string) { return (this.sessions.get(hash) ?? 0) > this.now(); }
  getFailureCount() { return this.failures; }
  recordFailure() { this.failures += 1; }
  clearFailures() { this.failures = 0; }
}

describe("AdminAuthService", () => {
  function fixture() {
    let nowMs = 1_000;
    let sequence = 0;
    const security: SecurityProvider = {
      randomToken: () => `admin-token-${String(++sequence).padEnd(32, "x")}`,
      sha256: (value) => `hash:${value}`,
      safeEqual: (left, right) => left === right,
    };
    const store = new MemoryAdminStore(() => nowMs);
    const auth = new AdminAuthService(
      security,
      store,
      { salt: "salt-1", passwordHash: "hash:salt-1:correct horse battery staple" },
      () => nowMs,
    );
    return { auth, store, advance: (ms: number) => { nowMs += ms; } };
  }

  it("issues a hashed four-hour session for the correct password", () => {
    const { auth, store } = fixture();
    const session = auth.login("correct horse battery staple");
    expect(session).toMatchObject({ adminToken: expect.any(String), expiresAtMs: 14_401_000 });
    expect(store.sessionTtl).toBe(14_400);
    expect([...store.sessions.keys()][0]).not.toBe(session.adminToken);
    expect(() => auth.requireSession(session.adminToken)).not.toThrow();
  });

  it("limits five failures for ten minutes and clears failures after success", () => {
    const { auth, store } = fixture();
    for (let index = 0; index < 5; index += 1) {
      expect(() => auth.login("wrong-password")).toThrow("ADMIN_LOGIN_FAILED");
    }
    expect(() => auth.login("correct horse battery staple")).toThrow("ADMIN_LOGIN_RATE_LIMITED");
    store.failures = 0;
    auth.login("correct horse battery staple");
    expect(store.failures).toBe(0);
  });

  it("rejects an expired raw token", () => {
    const { auth, advance } = fixture();
    const session = auth.login("correct horse battery staple");
    advance(14_400_001);
    expect(() => auth.requireSession(session.adminToken)).toThrow("ADMIN_SESSION_EXPIRED");
  });
});
