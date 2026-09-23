import { describe, expect, it } from "vitest";

import {
  createBrushingMachine,
  formatMinutesSeconds,
  timerState,
} from "@/features/brushing-session/brushing-machine";

describe("brushing timer", () => {
  it("formats fixed and free timers as minutes and seconds", () => {
    expect(formatMinutesSeconds(0)).toBe("00:00");
    expect(formatMinutesSeconds(60)).toBe("01:00");
    expect(formatMinutesSeconds(180)).toBe("03:00");
  });
  it("counts fixed time down from the selected duration", () => {
    const machine = createBrushingMachine({ mode: 60, startedAtMs: 0 });

    expect(machine.at(0)).toMatchObject({
      displaySec: 60,
      remainingSec: 60,
      state: "running",
    });
    expect(machine.at(60_000)).toMatchObject({
      displaySec: 0,
      remainingSec: 0,
      state: "readyToSubmit",
    });
  });

  it("counts free brushing up and unlocks completion at 60 seconds", () => {
    const machine = createBrushingMachine({ mode: "free", startedAtMs: 0 });

    expect(machine.at(59_999)).toMatchObject({
      displaySec: 59,
      ready: false,
      state: "running",
    });
    expect(machine.at(60_000)).toMatchObject({
      displaySec: 60,
      ready: true,
      state: "readyToSubmit",
    });
    expect(machine.at(301_000)).toMatchObject({
      displaySec: 300,
      reachedLimit: true,
    });
  });

  it("excludes hidden time in free mode", () => {
    const machine = createBrushingMachine({
      mode: "free",
      startedAtMs: 0,
      hiddenMs: 20_000,
    });

    expect(machine.at(70_000).elapsedSec).toBe(50);
  });

  it("does not become submittable before zero", () => {
    const machine = createBrushingMachine({ mode: 60, startedAtMs: 0 });
    expect(machine.at(59_999).state).toBe("running");
    expect(machine.at(60_000).state).toBe("readyToSubmit");
  });

  it("derives countdown from monotonic timestamps", () => {
    expect(timerState(10_000, 40_999, 60)).toMatchObject({
      elapsedSec: 30,
      remainingSec: 30,
      displaySec: 30,
      ready: false,
    });
  });

  it("records hidden time separately and excludes it from active time", () => {
    const machine = createBrushingMachine({
      mode: 60,
      startedAtMs: 0,
      hiddenMs: 20_000,
    });

    expect(machine.at(60_000)).toMatchObject({
      state: "running",
      elapsedSec: 40,
      hiddenSec: 20,
    });
    expect(machine.at(80_000).state).toBe("readyToSubmit");
  });
});
