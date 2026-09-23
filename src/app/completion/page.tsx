import { CompletionScreen } from "@/features/completion/completion-screen";

import styles from "./completion.module.css";

type CompletionPageProps = {
  searchParams: Promise<{ challenge?: string | string[] }>;
};

export default async function CompletionPage({ searchParams }: CompletionPageProps) {
  const params = await searchParams;
  const challengeId = typeof params.challenge === "string" ? params.challenge : "";
  return (
    <main className={`app-shell ${styles.shell}`}>
      <CompletionScreen challengeId={challengeId} />
    </main>
  );
}
