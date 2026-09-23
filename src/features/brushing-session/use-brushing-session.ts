"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

import type { CameraStartResult } from "@/lib/camera/camera-controller";
import {
  StartAttemptResultSchema,
  type StartAttemptResult,
} from "@/shared/contracts";

import {
  createBrushingMachine,
  type BrushingDuration,
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
  now?: () => number;
};

export type RunningSession = StartAttemptResult & {
  challengeId: string;
  deviceToken: string;
  cameraMode: "camera" | "timer-only";
  stream: MediaStream | null;
  startedAtMs: number;
  elapsedSec: number;
  remainingSec: number;
  hiddenSec: number;
};

export type BrushingSessionState =
  | { status: "choosing" }
  | { status: "explaining"; durationSec: BrushingDuration }
  | { status: "requestingCamera"; durationSec: BrushingDuration }
  | ({ status: "running" } & RunningSession)
  | ({ status: "readyToSubmit" } & RunningSession)
  | { status: "error"; message: string };

export function useBrushingSession(
  challengeId: string,
  services: BrushingSessionServices,
) {
  const [state, setState] = useState<BrushingSessionState>({ status: "choosing" });
  const now = useCallback(() => services.now?.() ?? performance.now(), [services]);

  const chooseDuration = useCallback((durationSec: BrushingDuration) => {
    setState({ status: "explaining", durationSec });
  }, []);

  const start = useCallback(async () => {
    if (state.status !== "explaining") return;
    const durationSec = state.durationSec;
    setState({ status: "requestingCamera", durationSec });
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
          { challengeId, selectedDurationSec: durationSec },
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
        remainingSec: durationSec,
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
        durationSec: timerDurationSec,
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

  return { state, chooseDuration, start };
}
