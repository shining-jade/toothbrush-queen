import type { AdminDashboardResult } from "@/shared/contracts";

import styles from "./teacher-dashboard.module.css";

export function DashboardSummary({ summary }: { summary: AdminDashboardResult["summary"] }) {
  const cards = [
    ["전체 학생", summary.totalStudents],
    ["오늘 참여", summary.completedToday],
    ["오늘 미참여", summary.missingToday],
    ["완주 학생", summary.completedChallenge],
  ] as const;
  return (
    <section className={styles.summaryGrid} aria-label="참여 요약">
      {cards.map(([label, value]) => (
        <article key={label} className={styles.summaryCard} aria-label={label}>
          <span>{label}</span>
          <strong>{value}명</strong>
        </article>
      ))}
    </section>
  );
}
