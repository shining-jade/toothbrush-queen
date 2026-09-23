"use client";

import { useMemo, useState } from "react";

import {
  CompletionScreen,
  type CompletionScreenServices,
} from "@/features/completion/completion-screen";
import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { CameraController } from "@/lib/camera/camera-controller";
import { getClientConfig } from "@/lib/config/client-env";
import { DeviceSessionStore } from "@/lib/device-session/device-session-store";
import type { SubmitCompletionInput } from "@/shared/contracts";

import { CameraPreview } from "./camera-preview";
import {
  useBrushingSession,
  type BrushingSessionServices,
} from "./use-brushing-session";

export type BrushingScreenServices = BrushingSessionServices;

function createBrowserServices(): BrushingScreenServices {
  return {
    camera: new CameraController(),
    api: new AppsScriptClient(getClientConfig().appsScriptUrl),
    sessionStore: new DeviceSessionStore(),
  };
}

export function BrushingScreen({
  challengeId,
  services,
  completionServices,
}: {
  challengeId: string;
  services?: BrushingScreenServices;
  completionServices?: CompletionScreenServices;
}) {
  const [completionInput, setCompletionInput] = useState<SubmitCompletionInput | null>(null);
  const activeServices = useMemo(() => services ?? createBrowserServices(), [services]);
  const { state, chooseDuration, start } = useBrushingSession(
    challengeId,
    activeServices,
  );

  if (completionInput) {
    return <CompletionScreen input={completionInput} services={completionServices} />;
  }

  if (state.status === "choosing") {
    return (
      <section className="brush-card">
        <h1>오늘은 얼마나 양치할까요?</h1>
        <div className="duration-grid">
          <button type="button" onClick={() => chooseDuration(60)}>60초</button>
          <button type="button" onClick={() => chooseDuration(180)}>180초</button>
        </div>
      </section>
    );
  }

  if (state.status === "explaining") {
    return (
      <section className="brush-card">
        <h1>카메라 사용 안내</h1>
        <p>카메라는 AR 스킨 표시와 챌린지 진행을 위해 사용됩니다. 카메라 영상과 얼굴 이미지는 저장되지 않습니다.</p>
        <button type="button" className="primary-action" onClick={() => void start()}>
          확인하고 시작하기
        </button>
      </section>
    );
  }

  if (state.status === "requestingCamera") {
    return <section className="brush-card" aria-live="polite">양치 도전을 준비하고 있어요.</section>;
  }

  if (state.status === "error") {
    return <section className="brush-card" role="alert">{state.message}</section>;
  }

  return (
    <section className="brushing-stage">
      {state.stream ? (
        <CameraPreview stream={state.stream} />
      ) : (
        <div className="timer-only">카메라 없이 타이머로 진행 중이에요.</div>
      )}
      <div className="countdown" aria-live="polite">
        <strong>{state.remainingSec}</strong>
        <span>초</span>
      </div>
      <p>{state.status === "readyToSubmit" ? "양치 완료!" : "구석구석 꼼꼼하게 양치해요."}</p>
      <button
        type="button"
        className="primary-action"
        disabled={state.status !== "readyToSubmit"}
        onClick={() => {
          if (state.status !== "readyToSubmit") return;
          setCompletionInput({
            challengeId: state.challengeId,
            attemptToken: state.attemptToken,
            idempotencyKey: crypto.randomUUID(),
            elapsedSec: state.elapsedSec,
            faceDetectedSec: null,
            cameraMode: state.cameraMode,
          });
          activeServices.camera.stop();
        }}
      >
        양치 완료 기록하기
      </button>
    </section>
  );
}
