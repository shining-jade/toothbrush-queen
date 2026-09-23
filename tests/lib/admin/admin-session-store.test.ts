import { describe, expect, it } from "vitest";

import { AdminSessionStore } from "@/lib/admin/admin-session-store";

describe("AdminSessionStore", () => {
  it("round-trips a valid session and clears an expired one", () => {
    let now = 1_000;
    const store = new AdminSessionStore(sessionStorage, () => now);
    store.set({ adminToken: "a".repeat(32), expiresAtMs: 2_000 });
    expect(store.get()?.adminToken).toBe("a".repeat(32));
    now = 2_001;
    expect(store.get()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("clears malformed browser data", () => {
    sessionStorage.setItem("brush-king:admin-session", "not-json");
    expect(new AdminSessionStore(sessionStorage).get()).toBeNull();
  });
});
