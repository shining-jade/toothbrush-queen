import { describe, expect, it, vi } from "vitest";

import { CameraController } from "@/lib/camera/camera-controller";

describe("CameraController", () => {
  it("requests only a front-facing video stream", async () => {
    const stream = { getTracks: vi.fn(() => []) } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const controller = new CameraController({ getUserMedia } as unknown as MediaDevices);

    await expect(controller.start()).resolves.toEqual({ mode: "camera", stream });
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "user" },
      audio: false,
    });
  });

  it("falls back to timer-only when permission is denied", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const controller = new CameraController({ getUserMedia } as unknown as MediaDevices);

    await expect(controller.start()).resolves.toEqual({
      mode: "timer-only",
      stream: null,
    });
  });

  it("falls back when media devices are unavailable", async () => {
    const controller = new CameraController(null);
    await expect(controller.start()).resolves.toEqual({
      mode: "timer-only",
      stream: null,
    });
  });

  it("stops every current stream track", async () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    const stream = { getTracks: () => tracks } as unknown as MediaStream;
    const controller = new CameraController({
      getUserMedia: vi.fn().mockResolvedValue(stream),
    } as unknown as MediaDevices);

    await controller.start();
    controller.stop();

    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(tracks[1].stop).toHaveBeenCalledOnce();
  });
});
