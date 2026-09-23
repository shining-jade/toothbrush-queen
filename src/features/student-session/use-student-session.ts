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
  | { status: "loading" }
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
};

export function useStudentSession(
  challengeId: string,
  services: StudentSessionServices,
) {
  const [state, setState] = useState<StudentSessionState>({ status: "loading" });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    let loadedChallenge: Challenge | null = null;

    async function load() {
      if (!ChallengeIdSchema.safeParse(challengeId).success) {
        setState({ status: "error", code: "INVALID_CHALLENGE" });
        return;
      }

      try {
        const challenge = (await services.api.request(
          "challenge.get",
          { challengeId },
          ChallengeSchema,
        )) as Challenge;
        loadedChallenge = challenge;

        if (!active) return;
        if (challenge.status === "draft") {
          setState({ status: "error", code: "INACTIVE_CHALLENGE" });
          return;
        }

        const deviceToken = services.sessionStore.get(challengeId);
        if (!deviceToken) {
          setState({ status: "needsIdentity", challenge });
          return;
        }

        const resumed = ResumeStudentResultSchema.parse(
          await services.api.request(
            "session.resume",
            { challengeId },
            ResumeStudentResultSchema,
            { deviceToken },
          ),
        );

        if (!active) return;
        if (resumed.status === "unauthenticated") {
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
          if (loadedChallenge) {
            setState({ status: "needsIdentity", challenge: loadedChallenge });
          }
          else setState({ status: "error", code: error.code });
          return;
        }
        setState({
          status: "error",
          code: error instanceof ApiError ? error.code : "UNEXPECTED_ERROR",
        });
      }
    }

    void load();
    return () => {
      active = false;
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
