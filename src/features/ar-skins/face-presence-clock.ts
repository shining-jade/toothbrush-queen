type PresenceUpdate = {
  nowMs: number;
  visible: boolean;
  documentVisible: boolean;
};

export class FacePresenceClock {
  private totalMs = 0;
  private lastMs: number | null = null;
  private previousVisible = false;

  update({ nowMs, visible, documentVisible }: PresenceUpdate) {
    if (!documentVisible) {
      this.lastMs = null;
      this.previousVisible = false;
      return;
    }

    if (this.lastMs !== null && visible && this.previousVisible) {
      const deltaMs = Math.max(0, nowMs - this.lastMs);
      this.totalMs += Math.min(deltaMs, 250);
    }
    this.lastMs = nowMs;
    this.previousVisible = visible;
  }

  seconds(elapsedSec: number) {
    return Math.min(this.totalMs / 1000, Math.max(0, elapsedSec));
  }
}
