import { AdminLoginResultSchema, type AdminLoginResult } from "@/shared/contracts";

const KEY = "brush-king:admin-session";

export class AdminSessionStore {
  constructor(
    private readonly storage: Storage = sessionStorage,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(): AdminLoginResult | null {
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return null;
      const session = AdminLoginResultSchema.parse(JSON.parse(raw));
      if (session.expiresAtMs <= this.now()) {
        this.clear();
        return null;
      }
      return session;
    } catch {
      this.clear();
      return null;
    }
  }

  set(session: AdminLoginResult) {
    this.storage.setItem(KEY, JSON.stringify(AdminLoginResultSchema.parse(session)));
  }

  clear() {
    this.storage.removeItem(KEY);
  }
}
