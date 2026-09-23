import type { AdminLoginResult } from "../../../src/shared/contracts";
import type { AdminSessionStore } from "../platform/admin-session-store";
import type { SecurityProvider } from "../platform/security";

const SESSION_TTL_SECONDS = 4 * 60 * 60;
const FAILURE_TTL_SECONDS = 10 * 60;
const MAX_FAILURES = 5;

type AdminAuthConfig = { salt: string; passwordHash: string };

export class AdminAuthService {
  constructor(
    private readonly security: SecurityProvider,
    private readonly sessions: AdminSessionStore,
    private readonly config: AdminAuthConfig,
    private readonly nowMs: () => number,
  ) {}

  login(password: string): AdminLoginResult {
    if (this.sessions.getFailureCount() >= MAX_FAILURES) {
      throw new Error("ADMIN_LOGIN_RATE_LIMITED");
    }
    const candidate = this.security.sha256(`${this.config.salt}:${password}`);
    if (!this.security.safeEqual(candidate, this.config.passwordHash)) {
      this.sessions.recordFailure(FAILURE_TTL_SECONDS);
      throw new Error("ADMIN_LOGIN_FAILED");
    }
    this.sessions.clearFailures();
    const adminToken = this.security.randomToken();
    this.sessions.putSession(this.security.sha256(adminToken), SESSION_TTL_SECONDS);
    return {
      adminToken,
      expiresAtMs: this.nowMs() + SESSION_TTL_SECONDS * 1000,
    };
  }

  requireSession(rawToken: string) {
    if (!rawToken || !this.sessions.hasSession(this.security.sha256(rawToken))) {
      throw new Error("ADMIN_SESSION_EXPIRED");
    }
  }
}
