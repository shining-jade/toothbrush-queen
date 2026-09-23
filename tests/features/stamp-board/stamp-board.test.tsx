import { statSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
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
      ).toHaveAttribute("src", expect.stringContaining("character-v-sign-stamp.webp"));
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

  it("starts the fresh stamp animation only after its image has loaded", () => {
    render(<StampBoard acceptedDays={3} targetDays={5} animateLatest />);

    const freshDay = screen.getByRole("listitem", { name: "3일차 완료" });
    const freshStamp = within(freshDay).getByRole("img");
    expect(freshDay).toHaveAttribute("data-animation", "waiting");

    fireEvent.load(freshStamp);

    expect(freshDay).toHaveAttribute("data-animation", "ready");
  });

  it("clamps accepted days to the board size", () => {
    render(<StampBoard acceptedDays={8} targetDays={5} />);
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });

  it("ships a mobile-sized default stamp asset", () => {
    const asset = resolve(process.cwd(), "public/stamps/character-v-sign-stamp.webp");
    expect(statSync(asset).size).toBeLessThan(200_000);
  });
});
