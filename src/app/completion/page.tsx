"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CompletionScreen } from "@/features/completion/completion-screen";

import styles from "./completion.module.css";

function CompletionScreenFromUrl() {
  const challengeId = useSearchParams().get("challenge") ?? "";

  return <CompletionScreen challengeId={challengeId} />;
}

export default function CompletionPage() {
  return (
    <main className={`app-shell ${styles.shell}`}>
      <Suspense fallback={null}>
        <CompletionScreenFromUrl />
      </Suspense>
    </main>
  );
}
