import type { BrushingMode } from "@/shared/brushing-mode";

export type BrushingDuration = 60 | 180;

export function formatMinutesSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function timerState(
  startedAtMs: number,
  nowMs: number,
  mode: BrushingMode,
  hiddenMs = 0,
) {
  const activeMs = Math.max(0, nowMs - startedAtMs - hiddenMs);
  const rawElapsedSec = Math.floor(activeMs / 1000);
  const elapsedSec = mode === "free"
    ? Math.min(300, rawElapsedSec)
    : Math.min(mode, rawElapsedSec);
  const remainingSec = mode === "free" ? null : mode - elapsedSec;
  const ready = mode === "free" ? elapsedSec >= 60 : elapsedSec >= mode;
  return {
    elapsedSec,
    remainingSec,
    displaySec: mode === "free" ? elapsedSec : remainingSec,
    ready,
    reachedLimit: mode === "free" && elapsedSec >= 300,
  };
}

type BrushingMachineInput = ({ mode: BrushingMode } | { durationSec: BrushingDuration }) & {
  startedAtMs: number;
  hiddenMs?: number;
};

export function createBrushingMachine(input: BrushingMachineInput) {
  const { startedAtMs, hiddenMs = 0 } = input;
  const mode = "mode" in input ? input.mode : input.durationSec;
  return {
    at(nowMs: number) {
      const timer = timerState(startedAtMs, nowMs, mode, hiddenMs);
      return {
        state: timer.ready ? "readyToSubmit" as const : "running" as const,
        ...timer,
        hiddenSec: Math.floor(hiddenMs / 1000),
      };
    },
  };
}
