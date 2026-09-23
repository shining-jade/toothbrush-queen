export type CameraStartResult = {
  mode: "camera" | "timer-only";
  stream: MediaStream | null;
};

export class CameraController {
  private stream: MediaStream | null = null;

  constructor(
    private readonly mediaDevices: Pick<MediaDevices, "getUserMedia"> | null =
      typeof navigator === "undefined" ? null : navigator.mediaDevices,
  ) {}

  async start(): Promise<CameraStartResult> {
    if (!this.mediaDevices?.getUserMedia) {
      return { mode: "timer-only", stream: null };
    }

    try {
      this.stop();
      this.stream = await this.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      return { mode: "camera", stream: this.stream };
    } catch {
      this.stream = null;
      return { mode: "timer-only", stream: null };
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
