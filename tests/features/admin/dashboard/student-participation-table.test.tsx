import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StudentParticipationTable } from "@/features/admin/dashboard/student-participation-table";
import type { AdminStudentSummary } from "@/shared/contracts";

const students: AdminStudentSummary[] = [
  { studentId: "stu-1", grade: "2", classNo: "3", studentNo: "12", name: "김민지", acceptedDays: 3, targetDays: 5, completedToday: true, lastParticipationDate: "2026-09-23", participationStatus: "completedToday" },
  { studentId: "stu-2", grade: "2", classNo: "4", studentNo: "7", name: "이학생", acceptedDays: 0, targetDays: 5, completedToday: false, lastParticipationDate: null, participationStatus: "noRecord" },
  { studentId: "stu-3", grade: "1", classNo: "3", studentNo: "2", name: "박완주", acceptedDays: 5, targetDays: 5, completedToday: true, lastParticipationDate: "2026-09-23", participationStatus: "completed" },
];

describe("StudentParticipationTable", () => {
  it("filters independently by grade, class, status, and student search", () => {
    render(<StudentParticipationTable students={students} />);

    expect(screen.getByRole("columnheader", { name: "스탬프 횟수" })).toBeVisible();
    expect(screen.getByText("스탬프 3 / 5개")).toBeVisible();

    fireEvent.change(screen.getByLabelText("학년 필터"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("반 필터"), { target: { value: "3" } });
    expect(screen.getByText("김민지")).toBeVisible();
    expect(screen.queryByText("이학생")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("반 필터"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("참여 상태 필터"), { target: { value: "noRecord" } });
    expect(screen.getByText("이학생")).toBeVisible();
    expect(screen.queryByText("김민지")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("참여 상태 필터"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("학생 검색"), { target: { value: "7" } });
    expect(screen.getByText("이학생")).toBeVisible();
  });
});
