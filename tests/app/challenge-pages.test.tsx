import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSearchParams } = vi.hoisted(() => ({
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams,
}));

vi.mock("@/features/student-session/student-entry", () => ({
  StudentEntry: ({ challengeId }: { challengeId: string }) => (
    <output aria-label="학생 챌린지">{challengeId || "없음"}</output>
  ),
}));

vi.mock("@/features/brushing-session/brushing-screen", () => ({
  BrushingScreen: ({ challengeId }: { challengeId: string }) => (
    <output aria-label="양치 챌린지">{challengeId || "없음"}</output>
  ),
}));

vi.mock("@/features/completion/completion-screen", () => ({
  CompletionScreen: ({ challengeId }: { challengeId: string }) => (
    <output aria-label="완료 챌린지">{challengeId || "없음"}</output>
  ),
}));

import HomePage from "@/app/page";
import { metadata } from "@/app/layout";
import BrushPage from "@/app/brush/page";
import CompletionPage from "@/app/completion/page";

function asClientPage(page: unknown) {
  return page as ComponentType;
}

describe("정적 학생 페이지의 챌린지 URL 연결", () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams("challenge=BRUSH5"));
  });

  it.each([
    ["학생", asClientPage(HomePage), "학생 챌린지"],
    ["양치", asClientPage(BrushPage), "양치 챌린지"],
    ["완료", asClientPage(CompletionPage), "완료 챌린지"],
  ])("%s 페이지가 URL의 챌린지 ID를 실제 화면에 전달한다", (_, Page, label) => {
    render(<Page />);

    expect(screen.getByLabelText(label)).toHaveTextContent("BRUSH5");
  });

  it("챌린지 값이 없으면 빈 ID로 학생 화면을 연다", () => {
    useSearchParams.mockReturnValue(new URLSearchParams());
    const Page = asClientPage(HomePage);

    render(<Page />);

    expect(screen.getByLabelText("학생 챌린지")).toHaveTextContent("없음");
  });

  it("칫솔 아이콘과 양치의 여왕 브랜드를 표시한다", () => {
    const Page = asClientPage(HomePage);
    render(<Page />);

    expect(screen.getByRole("heading", { name: "양치의 여왕" })).toBeVisible();
    expect(screen.getByText("🪥")).toBeVisible();
    expect(metadata.title).toBe("양치의 여왕");
  });
});
