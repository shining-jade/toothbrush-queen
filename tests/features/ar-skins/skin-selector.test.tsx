import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkinSelector } from "@/features/ar-skins/skin-selector";
import { mergeSkinCatalog } from "@/features/ar-skins/skin-registry";

describe("SkinSelector", () => {
  it("lets the student choose from the expanded bundled skin collection", () => {
    const onChange = vi.fn();
    render(<SkinSelector skins={mergeSkinCatalog()} value="cat" onChange={onChange} />);

    expect(screen.getAllByRole("radio")).toHaveLength(15);
    expect(screen.getByRole("radio", { name: "냥냥 볼터치" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "몽글 거품 왕관" }));

    expect(onChange).toHaveBeenCalledWith("bubble-crown");

    fireEvent.click(screen.getByRole("radio", { name: "복슬 강아지" }));
    expect(onChange).toHaveBeenCalledWith("puppy-hood");
  });

  it("offers a remote skin and removes only that option when its image fails", () => {
    const onChange = vi.fn();
    const skins = mergeSkinCatalog([{
      skinId: "skin-flower-1", name: "꽃님 사진관", imageUrl: "https://example.com/flower.png",
      anchorX: 0, anchorY: -0.4, scale: 1.5, rotationOffset: 0, version: 1, sortOrder: 1,
    }]);
    render(<SkinSelector skins={skins} value="skin-flower-1" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "꽃님 사진관" })).toBeVisible();
    fireEvent.error(screen.getByAltText("꽃님 사진관"));
    expect(screen.queryByRole("radio", { name: "꽃님 사진관" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "냥냥 볼터치" })).toBeVisible();
    expect(onChange).toHaveBeenCalledWith("cat");
  });
});
