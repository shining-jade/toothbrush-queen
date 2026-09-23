import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkinEditor } from "@/features/admin/skin-upload/skin-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("SkinEditor", () => {
  it("renders before browser API configuration is resolved", () => {
    render(<SkinEditor />);
    expect(screen.getByRole("heading", { name: "AR 스킨 관리" })).toBeInTheDocument();
  });

  it("restores a calibration draft after signing in again", async () => {
    render(<SkinEditor services={{
      getToken: () => "a".repeat(32), validateFile: vi.fn(), uploadAsset: vi.fn(), saveSkin: vi.fn(),
      listSkins: vi.fn().mockResolvedValue([]), setEnabled: vi.fn(), expireSession: vi.fn(),
      restoreDraft: () => ({ name: "다시 쓰는 스킨", anchorX: 0.2, anchorY: -0.1, scale: 1.7, rotationOffset: 12, sortOrder: 0 }),
    }} />);
    expect(await screen.findByDisplayValue("다시 쓰는 스킨")).toBeInTheDocument();
    expect(screen.getByTestId("calibration-values")).toHaveTextContent('"scale":1.7');
  });

  it("uploads and saves only once while a double submit is pending", async () => {
    let finish!: (value: { assetId: string; publicUrl: string }) => void;
    const uploadAsset = vi.fn(() => new Promise<{ assetId: string; publicUrl: string }>((done) => { finish = done; }));
    const services = {
      getToken: () => "a".repeat(32),
      validateFile: vi.fn().mockResolvedValue({ fileName: "flower.png", mimeType: "image/png", byteSize: 8, base64: "base64", previewUrl: "data:image/png;base64,base64" }),
      uploadAsset,
      saveSkin: vi.fn().mockResolvedValue({}),
      listSkins: vi.fn().mockResolvedValue([]),
      setEnabled: vi.fn(),
      expireSession: vi.fn(),
    };
    render(<SkinEditor services={services} />);
    fireEvent.change(screen.getByLabelText("스킨 이미지"), { target: { files: [new File(["12345678"], "flower.png", { type: "image/png" })] } });
    fireEvent.change(screen.getByLabelText("스킨 이름"), { target: { value: "꽃님 사진관" } });
    const save = screen.getByRole("button", { name: "저장하고 활성화" });
    fireEvent.click(save);
    fireEvent.click(save);
    await vi.waitFor(() => expect(uploadAsset).toHaveBeenCalledOnce());
    expect(save).toBeDisabled();
    finish({ assetId: "asset-1", publicUrl: "https://example.com/skin.png" });
    await vi.waitFor(() => expect(services.saveSkin).toHaveBeenCalledWith(
      "a".repeat(32), expect.objectContaining({ assetId: "asset-1", enabled: true }),
    ));
  });

  it("updates the preview as calibration controls change", () => {
    render(<SkinEditor services={{
      getToken: () => "a".repeat(32), validateFile: vi.fn(), uploadAsset: vi.fn(), saveSkin: vi.fn(),
      listSkins: vi.fn().mockResolvedValue([]), setEnabled: vi.fn(), expireSession: vi.fn(),
    }} />);
    const scale = screen.getByLabelText("크기");
    fireEvent.input(scale, { target: { value: "1.8" } });
    expect(scale).toHaveValue("1.8");
    expect(screen.getByTestId("calibration-values")).toHaveTextContent('"scale":1.8');
  });
});
