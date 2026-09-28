"use client";

import { type FormEvent, useState } from "react";

import type { AdminChallengeSaveInput, Challenge } from "@/shared/contracts";

import styles from "./teacher-dashboard.module.css";

const TARGET_DAY_PRESETS = [5, 10, 15, 20, 25, 30] as const;

function calculateEndDate(startDate: string, targetDays: number) {
  const startMs = Date.parse(`${startDate}T00:00:00.000Z`);
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs + (targetDays - 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function ChallengeSettingsForm({
  challenge,
  saving,
  onSave,
}: {
  challenge: Challenge;
  saving: boolean;
  onSave: (input: AdminChallengeSaveInput) => void;
}) {
  const [form, setForm] = useState<AdminChallengeSaveInput>({
    challengeId: challenge.challengeId,
    name: challenge.name,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    targetDays: challenge.targetDays,
    durationMode: challenge.durationMode,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(form);
  }
  function applyTargetDays(targetDays: number) {
    setForm((current) => ({
      ...current,
      targetDays,
      endDate: calculateEndDate(current.startDate, targetDays) ?? current.endDate,
    }));
  }

  return (
    <form className={styles.panel} onSubmit={submit}>
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>운영 설정</p><h2>챌린지 설정</h2></div>
        <span className={styles.challengeId}>{challenge.challengeId}</span>
      </div>
      <div className={styles.settingsGrid}>
        <label className={styles.fullField}>챌린지명
          <input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>시작일
          <input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
        </label>
        <label>종료일
          <input type="date" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
        </label>
        <div className={styles.fullField}>
          <span className={styles.fieldLabel}>목표 일수 빠른 선택</span>
          <div className={styles.presetButtons}>
            {TARGET_DAY_PRESETS.map((days) => (
              <button key={days} type="button" onClick={() => applyTargetDays(days)}>
                {days}일
              </button>
            ))}
          </div>
        </div>
        <label>목표 일수
          <input type="number" min={1} max={365} required value={form.targetDays} onChange={(event) => setForm({ ...form, targetDays: Number(event.target.value) })} />
        </label>
        <label>양치 시간
          <select value={form.durationMode} onChange={(event) => setForm({ ...form, durationMode: event.target.value === "choice" ? "choice" : Number(event.target.value) as 60 | 180 })}>
            <option value="choice">학생이 1분/3분 선택</option>
            <option value="60">1분</option>
            <option value="180">3분</option>
          </select>
        </label>
      </div>
      <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "저장 중" : "챌린지 설정 저장"}</button>
    </form>
  );
}
