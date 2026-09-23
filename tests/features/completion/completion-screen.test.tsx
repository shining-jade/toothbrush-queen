import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CompletionScreen,
  type CompletionScreenServices,
} from "@/features/completion/completion-screen";
import type { SubmitCompletionInput } from "@/shared/contracts";

const input: SubmitCompletionInput = {
  challengeId: "ABC123",
  attemptToken: "signed-attempt-token-1234567890",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  elapsedSec: 60,
  faceDetectedSec: null,
  cameraMode: "timer-only",
};

const result = {
  completionId: "completion-1",
  challengeId: "ABC123",
  participationDate: "2026-09-23",
  acceptedDays: 3,
  targetDays: 5,
  newlyAccepted: true,
};

describe("CompletionScreen", () => {
  it("ignores a second submit click while the first is pending", async () => {
    let resolve!: (value: { status: "submitted"; result: typeof result }) => void;
    const deferred = new Promise<{ status: "submitted"; result: typeof result }>(
      (done) => { resolve = done; },
    );
    const services: CompletionScreenServices = {
      submitOrQueue: vi.fn(() => deferred),
      retryPending: vi.fn(),
      loadPending: vi.fn(() => null),
      getDeviceToken: vi.fn(() => "device-token"),
    };
    render(<CompletionScreen input={input} services={services} />);

    expect(screen.getByText("총 1분 0초 동안 양치했어요.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "챌린지 완료하고 제출하기" }));
    expect(screen.getByRole("button", { name: "제출 중" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "양치 기록을 제출하고 있어요." })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "제출 중" }));
    expect(services.submitOrQueue).toHaveBeenCalledOnce();

    await act(async () => resolve({ status: "submitted", result }));
  });

  it("shows a retry action when transmission is pending", async () => {
    const services: CompletionScreenServices = {
      submitOrQueue: vi.fn().mockResolvedValue({ status: "pending" }),
      retryPending: vi.fn(),
      loadPending: vi.fn(() => null),
      getDeviceToken: vi.fn(() => "device-token"),
    };
    render(<CompletionScreen input={input} services={services} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "챌린지 완료하고 제출하기" }));
    });

    expect(screen.getByText("기록 전송이 보류되었습니다")).toBeVisible();
    expect(screen.getByRole("button", { name: "다시 전송하기" })).toBeVisible();
  });

  it("shows the confirmed count and a home link after success", async () => {
    const services: CompletionScreenServices = {
      submitOrQueue: vi.fn().mockResolvedValue({ status: "submitted", result }),
      retryPending: vi.fn(),
      loadPending: vi.fn(() => null),
      getDeviceToken: vi.fn(() => "device-token"),
    };
    render(<CompletionScreen input={input} services={services} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "챌린지 완료하고 제출하기" }));
    });

    expect(screen.getByRole("heading", { name: "양치 완료!" })).toBeVisible();
    expect(screen.getByText("총 1분 0초 동안 양치했어요.")).toBeVisible();
    expect(screen.getByText("3 / 5일")).toBeVisible();
    expect(screen.getByText("오늘 기록이 새로 인정되었어요.")).toBeVisible();
    expect(screen.getByLabelText("도장판: 5일 중 3일 완료")).toBeVisible();
    expect(screen.getByRole("listitem", { name: "3일차 완료" })).toHaveAttribute(
      "data-fresh",
      "true",
    );
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute(
      "href",
      "/?challenge=ABC123",
    );
  });
});
