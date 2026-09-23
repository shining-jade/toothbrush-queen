import { afterEach, describe, expect, it, vi } from "vitest";

import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { ApiError } from "@/lib/api/api-error";
import { ChallengeSchema } from "@/shared/contracts";

const challenge = {
  challengeId: "ABC123", name: "5일 양치왕", startDate: "2026-09-20",
  endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul",
  durationMode: "choice" as const, dailyLimit: 1, status: "active" as const,
};

describe("AppsScriptClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts a simple text/plain request and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: challenge })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new AppsScriptClient("https://script.google.com/macros/s/example/exec");

    await expect(
      client.request("challenge.get", { challengeId: "ABC123" }, ChallengeSchema),
    ).resolves.toEqual(challenge);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
  });

  it("maps a server authentication failure without exposing the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, error: { code: "UNAUTHENTICATED", message: "인증이 필요합니다." },
    }))));
    const client = new AppsScriptClient("https://script.google.com/macros/s/example/exec");

    await expect(client.request(
      "progress.get", { challengeId: "ABC123", privateName: "김민지" }, ChallengeSchema,
      { deviceToken: "secret-device-token-value" },
    )).rejects.toEqual(new ApiError("UNAUTHENTICATED", "인증이 필요합니다."));
  });

  it("maps fetch rejection to NETWORK_UNAVAILABLE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret network body")));
    const client = new AppsScriptClient("https://script.google.com/macros/s/example/exec");
    await expect(client.request("challenge.get", {}, ChallengeSchema)).rejects.toEqual(
      new ApiError("NETWORK_UNAVAILABLE", "네트워크 연결을 확인해 주세요."),
    );
  });
});
