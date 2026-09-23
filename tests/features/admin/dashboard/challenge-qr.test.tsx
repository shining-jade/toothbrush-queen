import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChallengeQr } from "@/features/admin/dashboard/challenge-qr";

describe("ChallengeQr", () => {
  it("creates a downloadable QR for the exact student participation URL", async () => {
    const createQr = vi.fn().mockResolvedValue("data:image/png;base64,qr-image");
    render(<ChallengeQr challengeId="BRUSH5" origin="https://school.example" createQr={createQr} />);

    expect(await screen.findByRole("img", { name: "학생 참여 QR 코드" })).toHaveAttribute(
      "src", "data:image/png;base64,qr-image",
    );
    expect(createQr).toHaveBeenCalledWith("https://school.example/?challenge=BRUSH5");
    expect(screen.getByRole("link", { name: "QR 이미지 저장" })).toHaveAttribute("download", "양치의-여왕-BRUSH5-학생용-QR.png");
    expect(screen.getByDisplayValue("https://school.example/?challenge=BRUSH5")).toBeVisible();
  });
});
