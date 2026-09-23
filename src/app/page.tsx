export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="brand-header">
        <span aria-hidden="true">👑</span>
        <h1>양치왕</h1>
      </header>
      <section className="loading-panel" aria-live="polite" aria-busy="true">
        챌린지를 불러오고 있어요.
      </section>
    </main>
  );
}
