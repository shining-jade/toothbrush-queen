import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeacherDashboard, type TeacherDashboardServices } from "@/features/admin/dashboard/teacher-dashboard";
import type { AdminDashboardResult } from "@/shared/contracts";

const dashboard: AdminDashboardResult = {
  challenge: { challengeId: "BRUSH5", name: "양치의 여왕 챌린지", startDate: "2026-09-20", endDate: "2026-09-24", targetDays: 5, timeZone: "Asia/Seoul", durationMode: "choice", dailyLimit: 1, status: "active" },
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
    deleteStudent: vi.fn().mockResolvedValue({ deleted: true, challengeId: "BRUSH5", studentId: "stu-1" }),
    navigate: vi.fn(),
  };
}

describe("TeacherDashboard", () => {
  it("applies a twenty-day preset to the target and end date before saving", async () => {
    const activeServices = services();
    vi.mocked(activeServices.loadDashboard)
      .mockResolvedValueOnce(dashboard)
      .mockResolvedValueOnce({
        ...dashboard,
        challenge: { ...dashboard.challenge, targetDays: 20, endDate: "2026-10-09" },
        summary: { ...dashboard.summary, completedChallenge: 0 },
      });
    render(<TeacherDashboard challengeId="BRUSH5" services={activeServices} />);

    expect(await screen.findByRole("article", { name: "전체 참여자" })).toHaveTextContent("4명");
    expect(screen.getByText("양치의 여왕 교사 모드")).toBeVisible();
    expect(screen.getByRole("article", { name: "오늘 참여" })).toHaveTextContent("2명");
    expect(screen.getByRole("article", { name: "오늘 미참여" })).toHaveTextContent("2명");
    expect(screen.getByRole("article", { name: "완주 참여자" })).toHaveTextContent("1명");

    expect(screen.getByRole("button", { name: "30일" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "20일" }));
    expect(screen.getByLabelText("목표 일수")).toHaveValue(20);
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-10-09");
    fireEvent.click(screen.getByRole("button", { name: "챌린지 설정 저장" }));

    await vi.waitFor(() => expect(activeServices.saveChallenge).toHaveBeenCalledWith(
      "a".repeat(32),
      expect.objectContaining({ challengeId: "BRUSH5", targetDays: 20, endDate: "2026-10-09" }),
    ));
    await vi.waitFor(() => expect(activeServices.loadDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("챌린지 설정을 저장했어요.")).toBeVisible();
    expect(screen.getByRole("article", { name: "완주 참여자" })).toHaveTextContent("0명");
  });

  it("returns to login without loading data when the admin session is missing", async () => {
    const activeServices = services();
    vi.mocked(activeServices.getToken).mockReturnValue(null);
    render(<TeacherDashboard challengeId="BRUSH5" services={activeServices} />);

    await vi.waitFor(() => expect(activeServices.navigate).toHaveBeenCalledWith("/admin?returnTo=/admin/dashboard"));
    expect(activeServices.loadDashboard).not.toHaveBeenCalled();
  });

  it("confirms permanent deletion and refreshes the student list", async () => {
    const activeServices = services();
    vi.mocked(activeServices.loadDashboard)
      .mockResolvedValueOnce(dashboard)
      .mockResolvedValueOnce({
        ...dashboard,
        summary: { totalStudents: 0, completedToday: 0, missingToday: 0, completedChallenge: 0 },
        students: [],
      });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TeacherDashboard challengeId="BRUSH5" services={activeServices} />);

    fireEvent.click(await screen.findByRole("button", { name: "김민지 참여자 삭제" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("도장 기록, 소감, 자동로그인 정보"));
    await vi.waitFor(() => expect(activeServices.deleteStudent).toHaveBeenCalledWith(
      "a".repeat(32), "BRUSH5", "stu-1",
    ));
    expect(await screen.findByText("김민지 참여자와 모든 기록을 삭제했어요.")).toBeVisible();
    expect(screen.queryByText("김민지")).not.toBeInTheDocument();
    confirm.mockRestore();
  });
});
