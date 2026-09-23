export type BrushingDuration = 60 | 180;

export function timerState(
  startedAtMs: number,
  nowMs: number,
  durationSec: BrushingDuration,
  hiddenMs = 0,
) {
  const activeMs = Math.max(0, nowMs - startedAtMs - hiddenMs);
  const elapsedSec = Math.min(durationSec, Math.floor(activeMs / 1000));
  return {
    elapsedSec,
    remainingSec: durationSec - elapsedSec,
    ready: elapsedSec >= durationSec,
  };
}

type BrushingMachineInput = {
  durationSec: BrushingDuration;
  startedAtMs: number;
  hiddenMs?: number;
};

export function createBrushingMachine({
  durationSec,
  startedAtMs,
  hiddenMs = 0,
}: BrushingMachineInput) {
  return {
    at(nowMs: number) {
      const timer = timerState(startedAtMs, nowMs, durationSec, hiddenMs);
      return {
        state: timer.ready ? "readyToSubmit" as const : "running" as const,
        ...timer,
        hiddenSec: Math.floor(hiddenMs / 1000),
      };
    },
  };
}
