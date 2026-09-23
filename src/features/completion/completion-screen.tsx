"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { LoadingIndicator } from "@/components/loading-indicator";
import { CompletionService, type CompletionOutcome } from "@/features/completion/completion-service";
import { PendingCompletionStore } from "@/features/completion/pending-completion-store";
import { StampBoard } from "@/features/stamp-board/stamp-board";
import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { getClientConfig } from "@/lib/config/client-env";
import { DeviceSessionStore } from "@/lib/device-session/device-session-store";
import {
  CompletionResultSchema,
  type CompletionResult,
  type SubmitCompletionInput,
} from "@/shared/contracts";

export type CompletionScreenServices = {
  submitOrQueue: (
    input: SubmitCompletionInput,
    deviceToken: string,
  ) => Promise<CompletionOutcome>;
  retryPending: (
    challengeId: string,
    deviceToken: string,
  ) => Promise<CompletionOutcome>;
  loadPending: (challengeId: string) => SubmitCompletionInput | null;
  getDeviceToken: (challengeId: string) => string | null;
};

function createBrowserServices(): CompletionScreenServices {
  const client = new AppsScriptClient(getClientConfig().appsScriptUrl);
  const pendingStore = new PendingCompletionStore();
  const sessionStore = new DeviceSessionStore();
  const service = new CompletionService(
    {
      submit: (input, deviceToken) =>
        client.request("completion.submit", input, CompletionResultSchema, { deviceToken }),
    },
    pendingStore,
    sessionStore,
  );
  return {
    submitOrQueue: (input, deviceToken) => service.submitOrQueue(input, deviceToken),
    retryPending: (challengeId, deviceToken) =>
      service.retryPending(challengeId, deviceToken),
    loadPending: (challengeId) => pendingStore.load(challengeId),
    getDeviceToken: (challengeId) => sessionStore.get(challengeId),
  };
}

type ViewState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "pending" }
  | { status: "authenticationRequired" }
  | { status: "submitted"; result: CompletionResult }
  | { status: "error" };

export function CompletionScreen({
  challengeId,
  input,
  services,
}: {
  challengeId?: string;
  input?: SubmitCompletionInput;
  services?: CompletionScreenServices;
}) {
  const activeServices = useMemo(() => services ?? createBrowserServices(), [services]);
  const activeChallengeId = input?.challengeId ?? challengeId ?? "";
  const [activeInput] = useState(() => input ?? activeServices.loadPending(activeChallengeId));
  const [state, setState] = useState<ViewState>(() =>
    input || !activeServices.loadPending(activeChallengeId)
      ? { status: "idle" }
      : { status: "pending" },
  );

  async function handleOutcome(request: () => Promise<CompletionOutcome>) {
    if (state.status === "submitting") return;
    setState({ status: "submitting" });
    try {
      const outcome = await request();
      setState(outcome);
    } catch {
      setState({ status: "error" });
    }
  }

  const elapsedCopy = activeInput
    ? `총 ${Math.floor(activeInput.elapsedSec / 60)}분 ${activeInput.elapsedSec % 60}초 동안 양치했어요.`
    : null;

  function deviceToken(): string | null {
    return activeServices.getDeviceToken(activeChallengeId);
  }

  function submit() {
    const token = deviceToken();
    if (!input || !token) {
      setState({ status: "authenticationRequired" });
      return;
    }
    void handleOutcome(() => activeServices.submitOrQueue(input, token));
  }

  function retry() {
    const token = deviceToken();
    if (!token) {
      setState({ status: "authenticationRequired" });
      return;
    }
    void handleOutcome(() => activeServices.retryPending(activeChallengeId, token));
  }

  if (state.status === "submitted") {
    return (
      <section className="completion-card">
        <h1>양치 완료!</h1>
        {elapsedCopy && <p>{elapsedCopy}</p>}
        <strong className="completion-count">
          {state.result.acceptedDays} / {state.result.targetDays}일
        </strong>
        <p>
          {state.result.newlyAccepted
            ? "오늘 기록이 새로 인정되었어요."
            : "오늘 기록은 이미 인정되어 있어요."}
        </p>
        <StampBoard
          acceptedDays={state.result.acceptedDays}
          targetDays={state.result.targetDays}
          animateLatest={state.result.newlyAccepted}
        />
        <Link className="primary-action" href={`/?challenge=${encodeURIComponent(state.result.challengeId)}`}>
          홈으로 돌아가기
        </Link>
      </section>
    );
  }

  if (state.status === "authenticationRequired") {
    return (
      <section className="completion-card" role="alert">
        <h1>참여 정보를 다시 확인해 주세요</h1>
        <p>기록은 이 기기에 안전하게 보관되어 있어요. 다시 참여한 뒤 전송해 주세요.</p>
        <Link className="primary-action" href={`/?challenge=${encodeURIComponent(activeChallengeId)}`}>
          학생 정보 확인하기
        </Link>
      </section>
    );
  }

  return (
    <section className="completion-card">
      <h1>양치 기록 보내기</h1>
      {elapsedCopy && <p>{elapsedCopy}</p>}
      {state.status === "submitting" && <LoadingIndicator label="양치 기록을 제출하고 있어요." />}
      {state.status === "pending" && <p>기록 전송이 보류되었습니다</p>}
      {state.status === "error" && <p role="alert">기록을 전송하지 못했어요.</p>}
      {state.status === "pending" ? (
        <button type="button" className="primary-action" onClick={retry}>
          다시 전송하기
        </button>
      ) : (
        <button
          type="button"
          className="primary-action"
          onClick={submit}
          disabled={state.status === "submitting"}
        >
          {state.status === "submitting" ? "제출 중" : "챌린지 완료하고 제출하기"}
        </button>
      )}
    </section>
  );
}
