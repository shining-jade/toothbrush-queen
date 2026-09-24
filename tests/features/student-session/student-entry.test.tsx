import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StudentEntry } from "@/features/student-session/student-entry";
import type { StudentSessionServices } from "@/features/student-session/use-student-session";

const challenge = {
  challengeId: "ABC123",
  name: "양치의 여왕 챌린지",
  startDate: "2026-09-20",
  endDate: "2026-09-30",
  targetDays: 5,
  timeZone: "Asia/Seoul",
  durationMode: 60 as const,
  dailyLimit: 1,
  status: "active" as const,
};

const progress = {
  challengeId: "ABC123",
  studentId: "student-1",
  displayName: "2학년 3반 12번 김○○",
  acceptedDays: 2,
  targetDays: 5,
  completedToday: false,
};

function services(token: string | null): StudentSessionServices {
  let savedToken = token;
  return {
    api: {
      request: vi.fn(async (action: string, payload: unknown) => {
        if (action === "challenge.get") return challenge;
        if (action === "session.resume") {
          return { status: "authenticated", progress };
        }
        if (action === "student.join") {
          expect(payload).toEqual({
            challengeId: "ABC123",
            grade: "2",
            classNo: "3",
            studentNo: "12",
            name: "김민지",
          });
          return { deviceToken: "a".repeat(32), progress };
        }
        throw new Error(`unexpected action: ${action}`);
      }),
    },
    sessionStore: {
      get: vi.fn(() => savedToken),
      set: vi.fn((_challengeId, nextToken) => {
        savedToken = nextToken;
      }),
      clear: vi.fn(() => {
        savedToken = null;
      }),
    },
    now: () => new Date("2026-09-23T03:00:00Z"),
  };
}

describe("StudentEntry", () => {
  it("shows a spinner while the challenge is loading", () => {
    const testServices = services(null);
    testServices.api.request = vi.fn(() => new Promise(() => undefined));

    render(<StudentEntry challengeId="ABC123" services={testServices} />);

    expect(screen.getByRole("status", { name: "챌린지를 불러오고 있어요." })).toBeVisible();
  });

  it("resumes and offers a different-student action", async () => {
    render(<StudentEntry challengeId="ABC123" services={services("t".repeat(32))} />);

    expect(
      await screen.findByText("2학년 3반 12번 김○○ 학생으로 계속하기"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "다른 학생으로 참여하기" }),
    ).toBeVisible();
  });

  it("shows the four required fields when no valid token exists", async () => {
    render(<StudentEntry challengeId="ABC123" services={services(null)} />);

    expect(await screen.findByText("양치의 여왕 챌린지")).toBeVisible();
    for (const label of ["학년", "반", "번호", "이름"]) {
      expect(await screen.findByLabelText(label)).toBeVisible();
    }
  });

  it("shows a cheerful tooth-brushing queen illustration below the entry form", async () => {
    render(<StudentEntry challengeId="ABC123" services={services(null)} />);

    const illustration = await screen.findByRole("img", {
      name: "왕관을 쓰고 즐겁게 양치하는 학생",
    });

    const source = illustration.getAttribute("src");
    expect(source).not.toBeNull();
    expect(new URL(source ?? "", "http://localhost").searchParams.get("url")).toBe(
      "/images/brushing-queen-student.png",
    );
  });

  it("trims identity fields, joins once, and stores the returned token", async () => {
    const testServices = services(null);
    render(<StudentEntry challengeId="ABC123" services={testServices} />);

    fireEvent.change(await screen.findByLabelText("학년"), {
      target: { value: " 2 " },
    });
    fireEvent.change(screen.getByLabelText("반"), { target: { value: " 3 " } });
    fireEvent.change(screen.getByLabelText("번호"), {
      target: { value: " 12 " },
    });
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: " 김민지 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "챌린지 참여하기" }));

    expect(await screen.findByText("오늘의 양치 도전하기")).toBeVisible();
    expect(testServices.sessionStore.set).toHaveBeenCalledWith(
      "ABC123",
      "a".repeat(32),
    );
    expect(testServices.api.request).toHaveBeenCalledTimes(2);
  });

  it("clears only this challenge and returns to manual entry", async () => {
    const testServices = services("t".repeat(32));
    render(<StudentEntry challengeId="ABC123" services={testServices} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "다른 학생으로 참여하기" }),
    );

    await waitFor(() =>
      expect(testServices.sessionStore.clear).toHaveBeenCalledWith("ABC123"),
    );
    expect(await screen.findByLabelText("이름")).toBeVisible();
  });

  it("rejects an invalid or missing challenge code", async () => {
    render(<StudentEntry challengeId="" services={services(null)} />);

    expect(await screen.findByText("올바르지 않은 QR 코드예요.")).toBeVisible();
  });

  it("does not allow entry into an inactive challenge", async () => {
    const testServices = services(null);
    testServices.api.request = vi.fn(async () => ({ ...challenge, status: "draft" }));

    render(<StudentEntry challengeId="ABC123" services={testServices} />);

    expect(
      await screen.findByText("아직 참여할 수 없는 챌린지예요."),
    ).toBeVisible();
    expect(screen.queryByLabelText("이름")).toBeNull();
  });
});
