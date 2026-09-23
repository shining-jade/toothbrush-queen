export type CompletionSound = {
  prime: () => void;
  play: () => void;
  dispose: () => void;
};

export type CompletionFeedback = {
  prime: () => void;
  signal: () => void;
  dispose: () => void;
};

function createWebAudioSound(): CompletionSound {
  let context: AudioContext | null = null;

  const ensureContext = () => {
    if (context || typeof window === "undefined") return context;
    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    context = new AudioContextConstructor();
    return context;
  };

  return {
    prime() {
      const activeContext = ensureContext();
      if (activeContext?.state === "suspended") void activeContext.resume().catch(() => undefined);
    },
    play() {
      const activeContext = ensureContext();
      if (!activeContext) return;
      if (activeContext.state === "suspended") void activeContext.resume().catch(() => undefined);

      const startAt = activeContext.currentTime;
      [880, 1174].forEach((frequency, index) => {
        const toneAt = startAt + index * 0.2;
        const oscillator = activeContext.createOscillator();
        const gain = activeContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, toneAt);
        gain.gain.setValueAtTime(0.0001, toneAt);
        gain.gain.exponentialRampToValueAtTime(0.18, toneAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, toneAt + 0.16);
        oscillator.connect(gain);
        gain.connect(activeContext.destination);
        oscillator.start(toneAt);
        oscillator.stop(toneAt + 0.17);
      });
    },
    dispose() {
      const activeContext = context;
      context = null;
      if (activeContext && activeContext.state !== "closed") {
        void activeContext.close().catch(() => undefined);
      }
    },
  };
}

export function createCompletionFeedback({
  vibrate,
  sound = createWebAudioSound(),
}: {
  vibrate?: (pattern: number[]) => void;
  sound?: CompletionSound;
} = {}): CompletionFeedback {
  const activeVibrate = vibrate ?? ((pattern: number[]) => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  });

  return {
    prime: () => sound.prime(),
    signal() {
      try {
        activeVibrate([180, 100, 180]);
      } catch {
        // Unsupported vibration must never interrupt completion.
      }
      try {
        sound.play();
      } catch {
        // Unsupported audio must never interrupt completion.
      }
    },
    dispose: () => sound.dispose(),
  };
}
