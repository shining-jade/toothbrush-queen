"use client";

import Image from "next/image";
import { useState } from "react";

import styles from "./stamp-board.module.css";

const DEFAULT_STAMP_SRC = "/stamps/character-v-sign-stamp.webp";

type StampBoardProps = {
  acceptedDays: number;
  targetDays: number;
  animateLatest?: boolean;
  stampSrc?: string;
};

export function StampBoard({
  acceptedDays,
  targetDays,
  animateLatest = false,
  stampSrc = DEFAULT_STAMP_SRC,
}: StampBoardProps) {
  const safeTarget = Math.max(1, Math.floor(targetDays));
  const safeAccepted = Math.min(safeTarget, Math.max(0, Math.floor(acceptedDays)));
  const [freshStampReady, setFreshStampReady] = useState(false);

  return (
    <div
      className={styles.boardWrap}
      aria-label={`도장판: ${safeTarget}일 중 ${safeAccepted}일 완료`}
    >
      <p className={styles.heading}>나의 양치 출석판</p>
      <ol className={styles.board}>
        {Array.from({ length: safeTarget }, (_, index) => {
          const day = index + 1;
          const completed = day <= safeAccepted;
          const fresh = completed && animateLatest && day === safeAccepted;

          return (
            <li
              key={day}
              className={`${styles.day} ${completed ? styles.completed : styles.empty}`}
              aria-label={`${day}일차 ${completed ? "완료" : "미완료"}`}
              data-fresh={fresh ? "true" : undefined}
              data-animation={fresh ? (freshStampReady ? "ready" : "waiting") : undefined}
            >
              <span className={styles.dayLabel}>DAY {day}</span>
              <span className={styles.slot}>
                {completed ? (
                  <Image
                    className={`${styles.stamp} ${fresh && freshStampReady ? styles.freshStamp : ""}`}
                    src={stampSrc}
                    alt="양치 완료 캐릭터 도장"
                    width={112}
                    height={112}
                    priority={fresh}
                    onLoadCapture={fresh ? () => setFreshStampReady(true) : undefined}
                  />
                ) : (
                  <span className={styles.emptyDot} aria-hidden="true" />
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
