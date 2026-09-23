import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StudentDashboard } from "@/features/challenge/student-dashboard";
import type { Challenge, StudentProgress } from "@/shared/contracts";

const baseChallenge: Challenge = {
  challengeId: "ABC123",
  name: "5일 양치왕 챌린지",
  startDate: "2026-09-20",
  endDate: "2026-09-30",
  targetDays: 5,
  timeZone: "Asia/Seoul",
  durationMode: 60,
  dailyLimit: 1,
  status: "active",
};

const progress: StudentProgress = {
  challengeId: "ABC123",
  studentId: "student-1",
  displayName: "2학년 3반 12번 김○○",
  acceptedDays: 2,
  targetDays: 5,
  completedToday: false,
};

describe("StudentDashboard", () => {
  it("shows progress and links to today's brushing challenge", () => {
    render(
      <StudentDashboard
        challenge={baseChallenge}
        progress={progress}
        now={new Date("2026-09-23T03:00:00Z")}
      />,
    );

    expect(screen.getByRole("heading", { name: "5일 양치왕 챌린지" })).toBeVisible();
    expect(screen.getByText("2 / 5일")).toBeVisible();
    expect(screen.getByRole("link", { name: "오늘의 양치 도전하기" })).toHaveAttribute(
      "href",
      "/brush?challenge=ABC123",
    );
  });

  it("shows pre-start guidance without an action link", () => {
    render(
      <StudentDashboard
        challenge={{ ...baseChallenge, startDate: "2026-09-25" }}
        progress={progress}
        now={new Date("2026-09-23T03:00:00Z")}
      />,
    );

    expect(screen.getByText("챌린지가 곧 시작돼요.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "오늘의 양치 도전하기" })).toBeNull();
  });

  it("shows ended progress as read-only", () => {
    render(
      <StudentDashboard
        challenge={{ ...baseChallenge, status: "ended" }}
        progress={progress}
        now={new Date("2026-10-01T03:00:00Z")}
      />,
    );

    expect(screen.getByText("챌린지가 종료되었어요.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "오늘의 양치 도전하기" })).toBeNull();
  });

  it("shows today's completion instead of another action", () => {
    render(
      <StudentDashboard
        challenge={baseChallenge}
        progress={{ ...progress, completedToday: true }}
        now={new Date("2026-09-23T03:00:00Z")}
      />,
    );

    expect(screen.getByText("오늘의 양치를 완료했어요!")).toBeVisible();
    expect(screen.queryByRole("link", { name: "오늘의 양치 도전하기" })).toBeNull();
  });
});
