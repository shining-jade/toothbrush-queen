import { describe, expect, it } from "vitest";

import { PendingCompletionStore } from "@/features/completion/pending-completion-store";
import type { SubmitCompletionInput } from "@/shared/contracts";

const input: SubmitCompletionInput = {
  challengeId: "ABC123",
  attemptToken: "signed-attempt-token-1234567890",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  elapsedSec: 60,
  faceDetectedSec: null,
  cameraMode: "timer-only",
};

describe("PendingCompletionStore", () => {
  it("stores only the strict completion envelope", () => {
    const store = new PendingCompletionStore(localStorage);
    store.save(input);

    expect(store.load("ABC123")).toEqual(input);
    expect(localStorage.getItem("brush-king:pending:ABC123")).not.toContain("name");
    expect(localStorage.length).toBe(1);
  });

  it("clears malformed pending data", () => {
    localStorage.setItem("brush-king:pending:ABC123", JSON.stringify({ name: "민감정보" }));
    const store = new PendingCompletionStore(localStorage);

    expect(store.load("ABC123")).toBeNull();
    expect(localStorage.getItem("brush-king:pending:ABC123")).toBeNull();
  });

  it("clears only the selected challenge", () => {
    localStorage.setItem("brush-king:pending:OTHER1", "keep");
    const store = new PendingCompletionStore(localStorage);
    store.save(input);
    store.clear("ABC123");

    expect(store.load("ABC123")).toBeNull();
    expect(localStorage.getItem("brush-king:pending:OTHER1")).toBe("keep");
  });
});
