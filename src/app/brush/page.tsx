"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BrushingScreen } from "@/features/brushing-session/brushing-screen";

import styles from "./brush.module.css";

function BrushingScreenFromUrl() {
  const challengeId = useSearchParams().get("challenge") ?? "";

  return <BrushingScreen challengeId={challengeId} />;
}

export default function BrushPage() {
  return (
    <main className={`app-shell ${styles.shell}`}>
      <Suspense fallback={null}>
        <BrushingScreenFromUrl />
      </Suspense>
    </main>
  );
}
