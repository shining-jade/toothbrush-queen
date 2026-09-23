import { describe, expect, it, vi } from "vitest";

import { CompletionService } from "@/features/completion/completion-service";
import { PendingCompletionStore } from "@/features/completion/pending-completion-store";
import { ApiError } from "@/lib/api/api-error";
import type { CompletionResult, SubmitCompletionInput } from "@/shared/contracts";

const input: SubmitCompletionInput = {
  challengeId: "ABC123",
  attemptToken: "signed-attempt-token-1234567890",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  elapsedSec: 60,
  faceDetectedSec: null,
  cameraMode: "timer-only",
};

const successResult: CompletionResult = {
  completionId: "completion-1",
  challengeId: "ABC123",
  participationDate: "2026-09-23",
  acceptedDays: 3,
  targetDays: 5,
  newlyAccepted: true,
};

describe("CompletionService", () => {
  it("reuses the same idempotency key after a lost response", async () => {
    const store = new PendingCompletionStore(localStorage);
    const api = {
      submit: vi
        .fn()
        .mockRejectedValueOnce(new ApiError("NETWORK_UNAVAILABLE", "offline"))
        .mockResolvedValueOnce(successResult),
    };
    const service = new CompletionService(api, store, { clear: vi.fn() });

    await expect(service.submitOrQueue(input, "device-token")).resolves.toMatchObject({
      status: "pending",
    });
    await service.retryPending("ABC123", "device-token");

    expect(api.submit.mock.calls[1][0].idempotencyKey).toBe(input.idempotencyKey);
    expect(store.load(input.challengeId)).toBeNull();
  });

  it("keeps pending data and clears the device session after expiry", async () => {
    const store = new PendingCompletionStore(localStorage);
    const sessionStore = { clear: vi.fn() };
    const api = {
      submit: vi.fn().mockRejectedValue(new ApiError("UNAUTHENTICATED", "expired")),
    };
    const service = new CompletionService(api, store, sessionStore);

    await expect(service.submitOrQueue(input, "expired-token")).resolves.toEqual({
      status: "authenticationRequired",
    });
    expect(store.load("ABC123")).toEqual(input);
    expect(sessionStore.clear).toHaveBeenCalledWith("ABC123");
  });

  it("finishes immediately from the accepted submission response", async () => {
    const store = new PendingCompletionStore(localStorage);
    const api = {
      submit: vi.fn().mockResolvedValue(successResult),
    };
    const service = new CompletionService(api, store, { clear: vi.fn() });

    await expect(service.submitOrQueue(input, "device-token")).resolves.toEqual({
      status: "submitted",
      result: successResult,
    });
    expect(store.load("ABC123")).toBeNull();
  });
});
