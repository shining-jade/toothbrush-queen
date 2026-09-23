import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkinSelector } from "@/features/ar-skins/skin-selector";

describe("SkinSelector", () => {
  it("lets the student choose one of three basic skins", () => {
    const onChange = vi.fn();
    render(<SkinSelector value="cat" onChange={onChange} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "냥냥 볼터치" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "반짝 토끼" }));

    expect(onChange).toHaveBeenCalledWith("rabbit");
  });
});
