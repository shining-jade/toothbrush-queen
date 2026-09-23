import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StampBoard } from "@/features/stamp-board/stamp-board";

describe("StampBoard", () => {
  it("creates one circular slot for every target day", () => {
    render(<StampBoard acceptedDays={2} targetDays={5} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByLabelText("도장판: 5일 중 2일 완료")).toBeVisible();
  });

  it("shows the character stamp only in accepted slots", () => {
    render(<StampBoard acceptedDays={3} targetDays={5} />);

    for (const day of [1, 2, 3]) {
      expect(
        within(screen.getByRole("listitem", { name: `${day}일차 완료` })).getByRole("img"),
      ).toHaveAttribute("src", expect.stringContaining("character-v-sign-stamp.png"));
    }
    expect(screen.getByRole("listitem", { name: "4일차 미완료" })).not.toContainHTML("img");
    expect(screen.getByRole("listitem", { name: "5일차 미완료" })).not.toContainHTML("img");
  });

  it("marks only the latest newly accepted stamp for animation", () => {
    render(<StampBoard acceptedDays={3} targetDays={5} animateLatest />);

    expect(screen.getByRole("listitem", { name: "1일차 완료" })).not.toHaveAttribute(
      "data-fresh",
    );
    expect(screen.getByRole("listitem", { name: "2일차 완료" })).not.toHaveAttribute(
      "data-fresh",
    );
    expect(screen.getByRole("listitem", { name: "3일차 완료" })).toHaveAttribute(
      "data-fresh",
      "true",
    );
  });

  it("clamps accepted days to the board size", () => {
    render(<StampBoard acceptedDays={8} targetDays={5} />);
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });
});
