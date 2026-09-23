import { describe, expect, it } from "vitest";

import {
  createBrushingMachine,
  timerState,
} from "@/features/brushing-session/brushing-machine";

describe("brushing timer", () => {
  it("does not become submittable before zero", () => {
    const machine = createBrushingMachine({ durationSec: 60, startedAtMs: 0 });
    expect(machine.at(59_999).state).toBe("running");
    expect(machine.at(60_000).state).toBe("readyToSubmit");
  });

  it("derives countdown from monotonic timestamps", () => {
    expect(timerState(10_000, 40_999, 60)).toEqual({
      elapsedSec: 30,
      remainingSec: 30,
      ready: false,
    });
  });

  it("records hidden time separately and excludes it from active time", () => {
    const machine = createBrushingMachine({
      durationSec: 60,
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
