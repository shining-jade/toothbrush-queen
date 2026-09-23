import { StudentEntry } from "@/features/student-session/student-entry";

import styles from "./page.module.css";

type HomePageProps = {
  searchParams: Promise<{ challenge?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const challengeId = typeof params.challenge === "string" ? params.challenge : "";

  return (
    <main className="app-shell">
      <header className={`brand-header ${styles.header}`}>
        <span aria-hidden="true">👑</span>
        <h1>양치왕</h1>
      </header>
      <StudentEntry challengeId={challengeId} />
    </main>
  );
}
