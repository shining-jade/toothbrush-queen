"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { StudentEntry } from "@/features/student-session/student-entry";

import styles from "./page.module.css";

function StudentEntryFromUrl() {
  const challengeId = useSearchParams().get("challenge") ?? "";

  return <StudentEntry challengeId={challengeId} />;
}

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className={`brand-header ${styles.header}`}>
        <span aria-hidden="true">👑</span>
        <h1>양치왕</h1>
      </header>
      <Suspense fallback={null}>
        <StudentEntryFromUrl />
      </Suspense>
    </main>
  );
}
