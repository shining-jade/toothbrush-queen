"use client";

import { useMemo, useState, type FormEvent } from "react";

import { LoadingStory } from "@/components/loading-story";
import { StudentDashboard } from "@/features/challenge/student-dashboard";
import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { LocalChallengeCache } from "@/lib/challenge-cache/local-challenge-cache";
import { getClientConfig } from "@/lib/config/client-env";
import { DeviceSessionStore } from "@/lib/device-session/device-session-store";
import {
  STAFF_PARTICIPANT_GRADE,
  STAFF_PARTICIPANT_NUMBER,
} from "@/shared/contracts";

import {
  useStudentSession,
  type StudentSessionServices,
} from "./use-student-session";

type StudentEntryProps = {
  challengeId: string;
  services?: StudentSessionServices;
};

function createBrowserServices(): StudentSessionServices {
  return {
    api: new AppsScriptClient(getClientConfig().appsScriptUrl),
    sessionStore: new DeviceSessionStore(),
    challengeCache: new LocalChallengeCache(
      typeof window === "undefined" ? null : window.localStorage,
    ),
  };
}

export function StudentEntry({ challengeId, services }: StudentEntryProps) {
  const [participantType, setParticipantType] = useState<"student" | "staff">("student");
  const activeServices = useMemo(() => services ?? createBrowserServices(), [services]);
  const { state, joining, join, switchStudent } = useStudentSession(
    challengeId,
    activeServices,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isStaff = participantType === "staff";
    await join({
      grade: isStaff ? STAFF_PARTICIPANT_GRADE : String(form.get("grade") ?? "").trim(),
      classNo: String(form.get(isStaff ? "department" : "classNo") ?? "").trim(),
      studentNo: isStaff ? STAFF_PARTICIPANT_NUMBER : String(form.get("studentNo") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
    });
  }

  if (state.status === "loading") {
    return (
      <section className="loading-panel">
        <LoadingStory
          imageSrc="/images/brushing-queen-student-option-2.png"
          imageAlt="왕관을 쓰고 즐겁게 양치하는 학생"
          label="챌린지를 불러오고 있어요."
          progress={state.progress}
          priority
        />
      </section>
    );
  }

  if (state.status === "error") {
    const message = state.code === "INVALID_CHALLENGE"
      ? "올바르지 않은 QR 코드예요."
      : state.code === "INACTIVE_CHALLENGE"
        ? "아직 참여할 수 없는 챌린지예요."
        : "챌린지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
    return <section className="error-panel" role="alert">{message}</section>;
  }

  if (state.status === "authenticated") {
    return (
      <>
        <div className="resume-bar">
          <strong>{state.progress.displayName} 참여자로 계속하기</strong>
          <button type="button" className="text-button" onClick={switchStudent}>
            다른 참여자로 참여하기
          </button>
        </div>
        <StudentDashboard
          challenge={state.challenge}
          progress={state.progress}
          now={activeServices.now?.()}
        />
      </>
    );
  }

  return (
    <div className="student-entry">
      <section className="identity-card" aria-labelledby="join-title">
        <p className="eyebrow">{state.challenge.name}</p>
        <h2 id="join-title">참여 정보를 입력해 주세요</h2>
        <form onSubmit={handleSubmit}>
          <fieldset className="participant-type">
            <legend>참여자 구분</legend>
            <label>
              <input
                type="radio"
                name="participantType"
                value="student"
                checked={participantType === "student"}
                onChange={() => setParticipantType("student")}
              />
              학생
            </label>
            <label>
              <input
                type="radio"
                name="participantType"
                value="staff"
                checked={participantType === "staff"}
                onChange={() => setParticipantType("staff")}
              />
              교직원
            </label>
          </fieldset>
          {participantType === "student" ? (
            <div className="number-fields">
              <label>학년<input name="grade" inputMode="numeric" required /></label>
              <label>반<input name="classNo" inputMode="numeric" required /></label>
              <label>번호<input name="studentNo" inputMode="numeric" required /></label>
            </div>
          ) : (
            <label>부서<input name="department" required /></label>
          )}
          <label>이름<input name="name" autoComplete="name" required /></label>
          <button type="submit" className="primary-action" disabled={joining}>
            {joining ? "참여 중..." : "챌린지 참여하기"}
          </button>
        </form>
      </section>
    </div>
  );
}
