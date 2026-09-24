"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

import { ApiError } from "@/lib/api/api-error";
import {
  ChallengeIdSchema,
  ChallengeSchema,
  JoinStudentInputSchema,
  JoinStudentResultSchema,
  ResumeStudentResultSchema,
  type Challenge,
  type JoinStudentInput,
  type StudentProgress,
} from "@/shared/contracts";

export type StudentSessionState =
  | { status: "loading"; progress: number }
  | { status: "needsIdentity"; challenge: Challenge }
  | {
      status: "authenticated";
      challenge: Challenge;
      progress: StudentProgress;
      deviceToken: string;
    }
  | { status: "error"; code: string };

export type StudentSessionServices = {
  api: {
    request: (
      action: string,
      payload: unknown,
      responseSchema: z.ZodType,
      options?: { deviceToken?: string },
    ) => Promise<unknown>;
  };
  sessionStore: {
    get: (challengeId: string) => string | null;
    set: (challengeId: string, deviceToken: string) => void;
    clear: (challengeId: string) => void;
  };
  now?: () => Date;
  loadingHoldMs?: number;
};

export function useStudentSession(
  challengeId: string,
  services: StudentSessionServices,
) {
  const [state, setState] = useState<StudentSessionState>({ status: "loading", progress: 10 });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    const advance = (progress: number) => setState((current) => current.status === "loading"
      ? { ...current, progress: Math.max(current.progress, progress) }
      : current);
    const progressTimer = window.setInterval(() => {
      setState((current) => current.status === "loading" && current.progress < 90
        ? { ...current, progress: Math.min(90, current.progress + 6) }
        : current);
    }, 400);

    async function load() {
      try {
        if (!ChallengeIdSchema.safeParse(challengeId).success) {
          setState({ status: "error", code: "INVALID_CHALLENGE" });
          return;
        }

        const deviceToken = services.sessionStore.get(challengeId);
        const challengeRequest = services.api.request(
          "challenge.get",
          { challengeId },
          ChallengeSchema,
        ).then((value) => {
          if (active) advance(deviceToken ? 55 : 90);
          return value as Challenge;
        });
        const resumeRequest = deviceToken
          ? services.api.request(
              "session.resume",
              { challengeId },
              ResumeStudentResultSchema,
              { deviceToken },
            ).then((value) => {
              if (active) advance(85);
              return ResumeStudentResultSchema.parse(value);
            }).catch((error) => {
              if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
                return { status: "unauthenticated" as const };
              }
              throw error;
            })
          : Promise.resolve(null);
        const [challenge, resumed] = await Promise.all([challengeRequest, resumeRequest]);

        if (!active) return;
        setState({ status: "loading", progress: 100 });
        const loadingHoldMs = services.loadingHoldMs ?? 220;
        if (loadingHoldMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, loadingHoldMs));
        }
        if (!active) return;
        if (challenge.status === "draft") {
          setState({ status: "error", code: "INACTIVE_CHALLENGE" });
          return;
        }

        if (!deviceToken) {
          setState({ status: "needsIdentity", challenge });
          return;
        }

        if (!resumed || resumed.status === "unauthenticated") {
          services.sessionStore.clear(challengeId);
          setState({ status: "needsIdentity", challenge });
          return;
        }

        setState({
          status: "authenticated",
          challenge,
          progress: resumed.progress,
          deviceToken,
        });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
          services.sessionStore.clear(challengeId);
          setState({ status: "error", code: error.code });
          return;
        }
        setState({
          status: "error",
          code: error instanceof ApiError ? error.code : "UNEXPECTED_ERROR",
        });
      } finally {
        window.clearInterval(progressTimer);
      }
    }

    void load();
    return () => {
      active = false;
      window.clearInterval(progressTimer);
    };
  }, [challengeId, services]);

  const join = useCallback(
    async (identity: Omit<JoinStudentInput, "challengeId">) => {
      if (state.status !== "needsIdentity" || joining) return;
      setJoining(true);
      try {
        const input = JoinStudentInputSchema.parse({ challengeId, ...identity });
        const joined = JoinStudentResultSchema.parse(
          await services.api.request("student.join", input, JoinStudentResultSchema),
        );
        services.sessionStore.set(challengeId, joined.deviceToken);
        setState({
          status: "authenticated",
          challenge: state.challenge,
          progress: joined.progress,
          deviceToken: joined.deviceToken,
        });
      } catch (error) {
        setState({
          status: "error",
          code: error instanceof ApiError ? error.code : "INVALID_IDENTITY",
        });
      } finally {
        setJoining(false);
      }
    },
    [challengeId, joining, services, state],
  );

  const switchStudent = useCallback(() => {
    if (state.status !== "authenticated") return;
    services.sessionStore.clear(challengeId);
    setState({ status: "needsIdentity", challenge: state.challenge });
  }, [challengeId, services, state]);

  return { state, joining, join, switchStudent };
}
