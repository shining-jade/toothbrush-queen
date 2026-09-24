import Link from "next/link";

import { getChallengePhase } from "@/features/challenge/challenge-state";
import { StampBoard } from "@/features/stamp-board/stamp-board";
import type { Challenge, StudentProgress } from "@/shared/contracts";

type StudentDashboardProps = {
  challenge: Challenge;
  progress: StudentProgress;
  now?: Date;
};

export function StudentDashboard({
  challenge,
  progress,
  now = new Date(),
}: StudentDashboardProps) {
  const phase = getChallengePhase(challenge, now);
  const canStart = phase === "active" && !progress.completedToday;

  return (
    <section aria-labelledby="challenge-title" className="challenge-card">
      <p className="eyebrow">🪥 나의 양치 챌린지</p>
      <h2 id="challenge-title">{challenge.name}</h2>
      <p className="student-name">{progress.displayName}</p>

      <div className="progress-summary" aria-label="챌린지 진행 상황">
        <strong>{progress.acceptedDays} / {progress.targetDays}일</strong>
        <progress value={progress.acceptedDays} max={progress.targetDays}>
          {progress.acceptedDays} / {progress.targetDays}
        </progress>
      </div>

      <StampBoard
        acceptedDays={progress.acceptedDays}
        targetDays={progress.targetDays}
      />

      {phase === "upcoming" && <p className="status-copy">챌린지가 곧 시작돼요.</p>}
      {phase === "ended" && <p className="status-copy">챌린지가 종료되었어요.</p>}
      {phase === "inactive" && <p className="status-copy">아직 참여할 수 없는 챌린지예요.</p>}
      {phase === "active" && progress.completedToday && (
        <div className="retry-brushing">
          <p className="status-copy">오늘의 양치를 완료했어요!</p>
          <p className="status-copy">다시 해도 오늘 도장은 1개만 인정돼요.</p>
          <Link
            className="secondary-action"
            href={`/brush?challenge=${encodeURIComponent(challenge.challengeId)}`}
          >
            다시 양치하기
          </Link>
        </div>
      )}

      {canStart && (
        <Link
          className="primary-action"
          href={`/brush?challenge=${encodeURIComponent(challenge.challengeId)}`}
        >
          오늘의 양치 도전하기
        </Link>
      )}
    </section>
  );
}
