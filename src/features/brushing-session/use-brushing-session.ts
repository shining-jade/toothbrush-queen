"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  loadingHoldMs?: number;
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
  | { status: "loadingProgress"; progress: number }
  | { status: "progressError" }
  | { status: "choosing"; challenge: Challenge; progress: StudentProgress }
  | { status: "choosingSkin"; mode: BrushingMode; challenge: Challenge; progress: StudentProgress }
  | { status: "explaining"; mode: BrushingMode }
  | { status: "requestingCamera"; mode: BrushingMode; progress: number }
  | ({ status: "preparing" | "running" | "readyToSubmit" } & RunningSession)
  | { status: "error"; message: string };

export function useBrushingSession(
  challengeId: string,
  services: BrushingSessionServices,
) {
  const [state, setState] = useState<BrushingSessionState>({ status: "loadingProgress", progress: 10 });
  const [preflightAttempt, setPreflightAttempt] = useState(0);
  const operationGeneration = useRef(0);
  const now = useCallback(() => services.now?.() ?? performance.now(), [services]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const deviceToken = services.sessionStore.get(challengeId);
      if (!deviceToken) throw new Error("missing device session");
      const advance = (progress: number) => setState((current) => current.status === "loadingProgress"
        ? { ...current, progress: Math.max(current.progress, progress) }
        : current);
      const challengeRequest = services.getChallenge(challengeId).then((challenge) => {
        if (active) advance(45);
        return challenge;
      });
      const progressRequest = services.getProgress(challengeId, deviceToken).then((progress) => {
        if (active) advance(80);
        return progress;
      });
      const [challenge, progress] = await Promise.all([challengeRequest, progressRequest]);
      if (!active) return;
      setState({ status: "loadingProgress", progress: 100 });
      const loadingHoldMs = services.loadingHoldMs ?? 220;
      if (loadingHoldMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, loadingHoldMs));
      }
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
    const generation = ++operationGeneration.current;
    const advance = (progress: number) => setState((current) => current.status === "requestingCamera"
      ? { ...current, progress: Math.max(current.progress, progress) }
      : current);
    setState({ status: "requestingCamera", mode, progress: 10 });
    const deviceToken = services.sessionStore.get(challengeId);
    if (!deviceToken) {
      setState({ status: "error", message: "참여 정보를 다시 확인해 주세요." });
      return;
    }

    try {
      const cameraRequest = services.camera.start().then((camera) => {
        if (operationGeneration.current === generation) advance(55);
        return camera;
      });
      const attemptRequest = services.api.request(
          "brushing.start",
          { challengeId, selectedDurationSec: mode },
          StartAttemptResultSchema,
          { deviceToken },
        ).then((value) => {
          if (operationGeneration.current === generation) advance(90);
          return StartAttemptResultSchema.parse(value);
        });
      const [camera, attempt] = await Promise.all([cameraRequest, attemptRequest]);
      if (operationGeneration.current !== generation) return;
      setState({ status: "requestingCamera", mode, progress: 100 });
      const loadingHoldMs = services.loadingHoldMs ?? 220;
      if (loadingHoldMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, loadingHoldMs));
      }
      if (operationGeneration.current !== generation) return;
      setState({
        status: camera.mode === "camera" ? "preparing" : "running",
        ...attempt,
        challengeId,
        deviceToken,
        cameraMode: camera.mode,
        stream: camera.stream,
        startedAtMs: camera.mode === "camera" ? 0 : now(),
        elapsedSec: 0,
        remainingSec: attempt.durationSec === "free" ? null : attempt.durationSec,
        hiddenSec: 0,
      });
    } catch {
      services.camera.stop();
      setState({ status: "error", message: "양치 도전을 시작하지 못했어요." });
    }
  }, [challengeId, now, services, state]);

  const beginBrushing = useCallback(() => {
    setState((current) => current.status === "preparing"
      ? { ...current, status: "running", startedAtMs: now() }
      : current);
  }, [now]);

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

  useEffect(() => () => {
    operationGeneration.current += 1;
    services.camera.stop();
  }, [services]);

  const retryPreflight = useCallback(() => {
    setState({ status: "loadingProgress", progress: 10 });
    setPreflightAttempt((value) => value + 1);
  }, []);

  return { state, chooseDuration, confirmSkin, retryPreflight, start, beginBrushing };
}
