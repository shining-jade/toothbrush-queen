import { describe, expect, it, vi } from "vitest";

import { createCompletionFeedback } from "@/features/brushing-session/completion-feedback";

describe("completion feedback", () => {
  it("primes audio during the user gesture and signals with vibration and sound", () => {
    const vibrate = vi.fn();
    const sound = { prime: vi.fn(), play: vi.fn(), dispose: vi.fn() };
    const feedback = createCompletionFeedback({ vibrate, sound });

    feedback.prime();
    feedback.signal();

    expect(sound.prime).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith([180, 100, 180]);
    expect(sound.play).toHaveBeenCalledOnce();
  });

  it("still plays the completion sound when vibration is unavailable", () => {
    const sound = { prime: vi.fn(), play: vi.fn(), dispose: vi.fn() };
    const feedback = createCompletionFeedback({ sound });

    feedback.signal();

    expect(sound.play).toHaveBeenCalledOnce();
  });
});
