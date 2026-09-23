import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/api-error";
import {
  DeviceSessionStore,
  recoverFromAuthenticationError,
} from "@/lib/device-session/device-session-store";

describe("DeviceSessionStore", () => {
  beforeEach(() => localStorage.clear());

  it("stores no student name or progress", () => {
    const store = new DeviceSessionStore(localStorage);
    store.set("ABC123", "opaque-token-value-long-enough");
    expect(localStorage.getItem("brush-king:session:ABC123")).toBe(
      "opaque-token-value-long-enough",
    );
    expect(localStorage.length).toBe(1);
  });

  it("clears malformed stored tokens", () => {
    localStorage.setItem("brush-king:session:ABC123", "short");
    const store = new DeviceSessionStore(localStorage);
    expect(store.get("ABC123")).toBeNull();
    expect(localStorage.getItem("brush-king:session:ABC123")).toBeNull();
  });

  it("clears only the matching challenge after UNAUTHENTICATED", () => {
    const store = new DeviceSessionStore(localStorage);
    store.set("ABC123", "opaque-token-value-long-enough");
    store.set("XYZ789", "another-token-value-long-enough");
    expect(recoverFromAuthenticationError(
      new ApiError("UNAUTHENTICATED", "인증이 필요합니다."), "ABC123", store,
    )).toBe(true);
    expect(store.get("ABC123")).toBeNull();
    expect(store.get("XYZ789")).toBe("another-token-value-long-enough");
  });
});
