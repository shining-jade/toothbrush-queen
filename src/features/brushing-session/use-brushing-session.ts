"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

import type { CameraStartResult } from "@/lib/camera/camera-controller";
import {
  type Challenge,
  StartAttemptResultSchema,
  type StartAttemptResult,
  type StudentProgress,
} from "@/shared/contracts";
import type { BrushingMode } from "@/shared/brushing-mode";

import {
  createBrushingMachine,
} from "./brushing-machine";

export type BrushingSessionServices = {
  camera: {
    start: () => Promise<CameraStartResult>;
    stop: () => void;
  };
  api: {
    request: (
      action: string,
      payload: unknown,
      responseSchema: z.ZodType,
      options?: { deviceToken?: string },
    ) => Promise<unknown>;
  };
  sessionStore: { get: (challengeId: string) => string | null };
  getChallenge: (challengeId: string) => Promise<Challenge>;
  getProgress: (challengeId: string, deviceToken: string) => Promise<StudentProgress>;
  now?: () => number;
};

export type RunningSession = StartAttemptResult & {
  challengeId: string;
  deviceToken: string;
  cameraMode: "camera" | "timer-only";
  stream: MediaStream | null;
  startedAtMs: number;
  elapsedSec: number;
  remainingSec: number | null;
  hiddenSec: number;
};

export type BrushingSessionState =
  | { status: "loadingProgress" }
  | { status: "progressError" }
  | { status: "choosing"; challenge: Challenge; progress: StudentProgress }
  | { status: "choosingSkin"; mode: BrushingMode; challenge: Challenge; progress: StudentProgress }
  | { status: "explaining"; mode: BrushingMode }
  | { status: "requestingCamera"; mode: BrushingMode }
  | ({ status: "running" | "readyToSubmit" } & RunningSession)
  | { status: "error"; message: string };

export function useBrushingSession(
  challengeId: string,
  services: BrushingSessionServices,
) {
  const [state, setState] = useState<BrushingSessionState>({ status: "loadingProgress" });
  const [preflightAttempt, setPreflightAttempt] = useState(0);
  const now = useCallback(() => services.now?.() ?? performance.now(), [services]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const deviceToken = services.sessionStore.get(challengeId);
      if (!deviceToken) throw new Error("missing device session");
      const [challenge, progress] = await Promise.all([
        services.getChallenge(challengeId),
        services.getProgress(challengeId, deviceToken),
      ]);
      if (active) setState({ status: "choosing", challenge, progress });
    }).catch(() => {
      if (active) setState({ status: "progressError" });
    });
    return () => { active = false; };
  }, [challengeId, preflightAttempt, services]);

  const chooseDuration = useCallback((mode: BrushingMode) => {
    setState((current) => current.status === "choosing"
      ? { status: "choosingSkin", mode, challenge: current.challenge, progress: current.progress }
      : current);
  }, []);

  const confirmSkin = useCallback(() => {
    setState((current) => current.status === "choosingSkin"
      ? { status: "explaining", mode: current.mode }
      : current);
  }, []);

  const start = useCallback(async () => {
    if (state.status !== "explaining") return;
    const mode = state.mode;
    setState({ status: "requestingCamera", mode });
    const deviceToken = services.sessionStore.get(challengeId);
    if (!deviceToken) {
      setState({ status: "error", message: "참여 정보를 다시 확인해 주세요." });
      return;
    }

    try {
      const camera = await services.camera.start();
      const attempt = StartAttemptResultSchema.parse(
        await services.api.request(
          "brushing.start",
          { challengeId, selectedDurationSec: mode },
          StartAttemptResultSchema,
          { deviceToken },
        ),
      );
      setState({
        status: "running",
        ...attempt,
        challengeId,
        deviceToken,
        cameraMode: camera.mode,
        stream: camera.stream,
        startedAtMs: now(),
        elapsedSec: 0,
        remainingSec: attempt.durationSec === "free" ? null : attempt.durationSec,
        hiddenSec: 0,
      });
    } catch {
      services.camera.stop();
      setState({ status: "error", message: "양치 도전을 시작하지 못했어요." });
    }
  }, [challengeId, now, services, state]);

  const timerIsActive = state.status === "running" || state.status === "readyToSubmit";
  const timerDurationSec = timerIsActive ? state.durationSec : null;
  const timerStartedAtMs = timerIsActive ? state.startedAtMs : null;
  const timerHiddenSec = timerIsActive ? state.hiddenSec : 0;
  const timerStatus = timerIsActive ? state.status : null;

  useEffect(() => {
    if (timerDurationSec === null || timerStartedAtMs === null) return;

    let hiddenStartedAt: number | null = document.hidden ? now() : null;
    let hiddenMs = timerHiddenSec * 1000;

    const update = () => {
      const currentNow = now();
      const liveHiddenMs = hiddenMs + (hiddenStartedAt === null ? 0 : currentNow - hiddenStartedAt);
      const snapshot = createBrushingMachine({
        mode: timerDurationSec,
        startedAtMs: timerStartedAtMs,
        hiddenMs: liveHiddenMs,
      }).at(currentNow);
      setState((current) => {
        if (current.status !== "running" && current.status !== "readyToSubmit") return current;
        return {
          ...current,
          status: snapshot.state,
          elapsedSec: snapshot.elapsedSec,
          remainingSec: snapshot.remainingSec,
          hiddenSec: snapshot.hiddenSec,
        };
      });
    };

    const handleVisibility = () => {
      const currentNow = now();
      if (document.hidden && hiddenStartedAt === null) hiddenStartedAt = currentNow;
      if (!document.hidden && hiddenStartedAt !== null) {
        hiddenMs += currentNow - hiddenStartedAt;
        hiddenStartedAt = null;
      }
      update();
    };

    const interval = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", handleVisibility);
    update();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [now, timerDurationSec, timerHiddenSec, timerStartedAtMs, timerStatus]);

  useEffect(() => () => services.camera.stop(), [services]);

  const retryPreflight = useCallback(() => {
    setState({ status: "loadingProgress" });
    setPreflightAttempt((value) => value + 1);
  }, []);

  return { state, chooseDuration, confirmSkin, retryPreflight, start };
}
