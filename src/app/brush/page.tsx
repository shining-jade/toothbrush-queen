import { BrushingScreen } from "@/features/brushing-session/brushing-screen";

import styles from "./brush.module.css";

type BrushPageProps = {
  searchParams: Promise<{ challenge?: string | string[] }>;
};

export default async function BrushPage({ searchParams }: BrushPageProps) {
  const params = await searchParams;
  const challengeId = typeof params.challenge === "string" ? params.challenge : "";

  return (
    <main className={`app-shell ${styles.shell}`}>
      <BrushingScreen challengeId={challengeId} />
    </main>
  );
}
