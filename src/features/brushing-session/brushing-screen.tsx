"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LoadingStory } from "@/components/loading-story";
import { ArCameraPreview } from "@/features/ar-skins/ar-camera-preview";
import { AR_SKINS, mergeSkinCatalog, type ArSkin } from "@/features/ar-skins/skin-registry";
import { SkinSelector } from "@/features/ar-skins/skin-selector";
import {
  CompletionScreen,
  type CompletionScreenServices,
} from "@/features/completion/completion-screen";
import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { CameraController } from "@/lib/camera/camera-controller";
import { getClientConfig } from "@/lib/config/client-env";
import { DeviceSessionStore } from "@/lib/device-session/device-session-store";
import { createMediaPipeFaceTracker } from "@/lib/face-tracking/mediapipe-face-tracker";
import type { FaceTracker } from "@/lib/face-tracking/face-tracker";
import {
  ChallengeSchema,
  StudentProgressSchema,
  type SubmitCompletionInput,
} from "@/shared/contracts";

import { formatMinutesSeconds } from "./brushing-machine";
import { AdjustableCountdown } from "./adjustable-countdown";
import {
  createCompletionFeedback,
  type CompletionFeedback,
} from "./completion-feedback";
import {
  useBrushingSession,
  type BrushingSessionServices,
} from "./use-brushing-session";

export type BrushingScreenServices = BrushingSessionServices & {
  createFaceTracker: () => FaceTracker;
  completionFeedback: CompletionFeedback;
};

function createBrowserServices(): BrushingScreenServices {
  const client = new AppsScriptClient(getClientConfig().appsScriptUrl);
  const sessionStore = new DeviceSessionStore();
  return {
    camera: new CameraController(),
    api: client,
    sessionStore,
    getChallenge: (id) => client.request("challenge.get", { challengeId: id }, ChallengeSchema),
    getProgress: (id, deviceToken) => client.request(
      "progress.get",
      { challengeId: id },
      StudentProgressSchema,
      { deviceToken },
    ),
    createFaceTracker: () => createMediaPipeFaceTracker(),
    completionFeedback: createCompletionFeedback(),
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
  const [selectedSkin, setSelectedSkin] = useState<string>("cat");
  const [sessionSkin, setSessionSkin] = useState<ArSkin>(AR_SKINS.cat);
  const [faceDetectedSec, setFaceDetectedSec] = useState<number | null>(null);
  const activeServices = useMemo(() => services ?? createBrowserServices(), [services]);
  const tracker = useMemo(() => activeServices.createFaceTracker(), [activeServices]);
  const updateFaceDetectedSec = useCallback((seconds: number | null) => {
    setFaceDetectedSec(seconds);
  }, []);
  const { state, chooseDuration, confirmSkin, retryPreflight, start, beginBrushing } = useBrushingSession(
    challengeId,
    activeServices,
  );
  const previousTimerStatus = useRef(state.status);

  useEffect(() => {
    if (state.status === "readyToSubmit" && previousTimerStatus.current === "running") {
      activeServices.completionFeedback.signal();
    }
    previousTimerStatus.current = state.status;
  }, [activeServices, state.status]);

  useEffect(
    () => () => activeServices.completionFeedback.dispose(),
    [activeServices],
  );

  if (completionInput) {
    return <CompletionScreen input={completionInput} services={completionServices} />;
  }

  if (state.status === "loadingProgress") {
    return (
      <section className="brush-card">
        <LoadingStory
          imageSrc="/images/brushing-queen-progress-check.png"
          imageAlt="도장판의 도장을 세어 보는 학생"
          label="진행 상황을 확인하고 있어요."
          progress={state.progress}
          priority
        />
      </section>
    );
  }

  if (state.status === "progressError") {
    return (
      <section className="brush-card" role="alert">
        <p>진행 상황을 불러오지 못했어요.</p>
        <button type="button" className="primary-action" onClick={retryPreflight}>다시 시도</button>
      </section>
    );
  }

  if (state.status === "choosing") {
    const choices = state.challenge.durationMode === "choice"
      ? ([60, 180, "free"] as const)
      : ([state.challenge.durationMode] as const);
    return (
      <section className="brush-card">
        <h1>오늘은 얼마나 양치할까요?</h1>
        <div className="duration-grid">
          {choices.map((mode) => (
            <button key={mode} type="button" onClick={() => chooseDuration(mode)}>
              {mode === "free" ? "자유 양치" : `${mode}초`}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (state.status === "choosingSkin") {
    const finalDay = state.progress.acceptedDays === state.progress.targetDays - 1;
    const catalog = mergeSkinCatalog(state.challenge.skins);
    const activeSkin = finalDay ? AR_SKINS.crown : catalog.find((skin) => skin.id === selectedSkin) ?? AR_SKINS.cat;
    return (
      <section className="brush-card skin-choice-card">
        <h1>{finalDay ? "양치왕 왕관 스킨" : "오늘의 AR 스킨을 골라요"}</h1>
        {finalDay ? (
          <div className="crown-choice">
            <Image src={AR_SKINS.crown.src} alt="양치왕 왕관" width={180} height={180} />
            <p>마지막 도전! 양치왕 왕관이 자동으로 적용돼요.</p>
          </div>
        ) : <SkinSelector skins={catalog} value={selectedSkin} onChange={setSelectedSkin} />}
        <button type="button" className="primary-action" onClick={() => {
          setSessionSkin(activeSkin);
          confirmSkin();
        }}>이 스킨으로 시작하기</button>
      </section>
    );
  }

  if (state.status === "explaining") {
    return (
      <section className="brush-card">
        <h1>카메라 사용 안내</h1>
        <p>카메라는 AR 스킨 표시와 챌린지 진행을 위해 사용됩니다. 카메라 영상과 얼굴 이미지는 저장되지 않습니다.</p>
        <button type="button" className="primary-action" onClick={() => {
          activeServices.completionFeedback.prime();
          void start();
        }}>
          확인하고 시작하기
        </button>
      </section>
    );
  }

  if (state.status === "requestingCamera") {
    return (
      <section className="brush-card">
        <LoadingStory
          imageSrc="/images/brushing-queen-ready.png"
          imageAlt="거울 앞에서 양치를 준비하는 학생"
          label="양치 도전을 준비하고 있어요."
          progress={state.progress}
        />
      </section>
    );
  }

  if (state.status === "error") {
    return <section className="brush-card" role="alert">{state.message}</section>;
  }

  return (
    <section
      className="brushing-stage"
      data-complete={state.status === "readyToSubmit" ? "true" : undefined}
    >
      {state.stream ? (
        <ArCameraPreview
          stream={state.stream}
          skin={sessionSkin}
          tracker={tracker}
          elapsedSec={state.elapsedSec}
          onFaceDetectedSecChange={updateFaceDetectedSec}
          preparing={state.status === "preparing"}
          onReady={beginBrushing}
        />
      ) : (
        <div className="timer-only">카메라 없이 타이머로 진행 중이에요.</div>
      )}
      {state.status !== "preparing" && (
        <AdjustableCountdown
          value={formatMinutesSeconds(state.durationSec === "free" ? state.elapsedSec : state.remainingSec ?? 0)}
        />
      )}
      {state.status === "readyToSubmit" && state.durationSec !== "free" && (
        <div className="completion-celebration" role="status" aria-label="양치 시간 완료 알림">
          <strong>✨ 양치 완료! ✨</strong>
          <span>기록 버튼을 눌러주세요</span>
        </div>
      )}
      {state.status === "preparing" ? (
        <>
          <p>얼굴을 화면에 맞추면 자동으로 시작해요. 인식이 어려우면 바로 시작하세요.</p>
          <button type="button" className="primary-action" onClick={beginBrushing}>
            바로 시작하기
          </button>
        </>
      ) : <p>{state.status === "readyToSubmit" ? "양치 완료!" : "구석구석 꼼꼼하게 양치해요."}</p>}
      {state.status !== "preparing" && <button
        type="button"
        className="primary-action"
        onClick={() => {
          setCompletionInput({
            challengeId: state.challengeId,
            attemptToken: state.attemptToken,
            idempotencyKey: crypto.randomUUID(),
            elapsedSec: state.elapsedSec,
            faceDetectedSec,
            cameraMode: state.cameraMode,
          });
          activeServices.camera.stop();
        }}
      >
        양치 완료 기록하기
      </button>}
    </section>
  );
}
