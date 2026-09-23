import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingIndicator } from "@/components/loading-indicator";

describe("LoadingIndicator", () => {
  it("shows an accessible percentage and clamps it to the progress range", () => {
    const { rerender } = render(
      <LoadingIndicator label="준비하고 있어요." progress={140} />,
    );

    expect(screen.getByRole("progressbar", { name: "준비하고 있어요." })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText("100%")).toBeVisible();

    rerender(<LoadingIndicator label="준비하고 있어요." progress={-10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeVisible();
  });

  it("keeps the compact spinner for callers without measurable progress", () => {
    render(<LoadingIndicator label="QR 코드를 만들고 있어요." />);

    expect(screen.getByRole("status", { name: "QR 코드를 만들고 있어요." })).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

