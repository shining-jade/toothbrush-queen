import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeacherDashboard, type TeacherDashboardServices } from "@/features/admin/dashboard/teacher-dashboard";
import type { AdminDashboardResult } from "@/shared/contracts";

const dashboard: AdminDashboardResult = {
  challenge: { challengeId: "BRUSH5", name: "5일 양치왕", startDate: "2026-09-20", endDate: "2026-09-30", targetDays: 5, timeZone: "Asia/Seoul", durationMode: "choice", dailyLimit: 1, status: "active" },
  summary: { totalStudents: 4, completedToday: 2, missingToday: 2, completedChallenge: 1 },
  students: [
    { studentId: "stu-1", grade: "2", classNo: "3", studentNo: "12", name: "김민지", acceptedDays: 3, targetDays: 5, completedToday: true, lastParticipationDate: "2026-09-23", participationStatus: "completedToday" },
  ],
};

function services(): TeacherDashboardServices {
  return {
    getToken: vi.fn(() => "a".repeat(32)),
    loadDashboard: vi.fn().mockResolvedValue(dashboard),
    saveChallenge: vi.fn().mockImplementation(async (_token, input) => ({ ...dashboard.challenge, ...input })),
    navigate: vi.fn(),
  };
}

describe("TeacherDashboard", () => {
  it("loads teacher summaries and saves a ten-day preset", async () => {
    const activeServices = services();
    vi.mocked(activeServices.loadDashboard)
      .mockResolvedValueOnce(dashboard)
      .mockResolvedValueOnce({
        ...dashboard,
        challenge: { ...dashboard.challenge, targetDays: 10 },
        summary: { ...dashboard.summary, completedChallenge: 0 },
      });
    render(<TeacherDashboard challengeId="BRUSH5" services={activeServices} />);

    expect(await screen.findByRole("article", { name: "전체 학생" })).toHaveTextContent("4명");
    expect(screen.getByText("양치의 여왕 교사 모드")).toBeVisible();
    expect(screen.getByRole("article", { name: "오늘 참여" })).toHaveTextContent("2명");
    expect(screen.getByRole("article", { name: "오늘 미참여" })).toHaveTextContent("2명");
    expect(screen.getByRole("article", { name: "완주 학생" })).toHaveTextContent("1명");

    fireEvent.click(screen.getByRole("button", { name: "10일" }));
    expect(screen.getByLabelText("목표 일수")).toHaveValue(10);
    fireEvent.click(screen.getByRole("button", { name: "챌린지 설정 저장" }));

    await vi.waitFor(() => expect(activeServices.saveChallenge).toHaveBeenCalledWith(
      "a".repeat(32),
      expect.objectContaining({ challengeId: "BRUSH5", targetDays: 10 }),
    ));
    await vi.waitFor(() => expect(activeServices.loadDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("챌린지 설정을 저장했어요.")).toBeVisible();
    expect(screen.getByRole("article", { name: "완주 학생" })).toHaveTextContent("0명");
  });

  it("returns to login without loading data when the admin session is missing", async () => {
    const activeServices = services();
    vi.mocked(activeServices.getToken).mockReturnValue(null);
    render(<TeacherDashboard challengeId="BRUSH5" services={activeServices} />);

    await vi.waitFor(() => expect(activeServices.navigate).toHaveBeenCalledWith("/admin?returnTo=/admin/dashboard"));
    expect(activeServices.loadDashboard).not.toHaveBeenCalled();
  });
});
