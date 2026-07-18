import Link from "next/link";

export default function Page() {
  return (
    <main className="demo">
      <header>
        <div className="brand">
          Northstar <span>Demo Suite</span>
        </div>
      </header>
      <section className="card">
        <h1>Seeded business apps</h1>
        <p>Deterministic targets used by FlowProof browser verification.</p>
        <nav className="links">
          <Link href="/identity">Identity admin</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/policy">Access policy</Link>
        </nav>
      </section>
    </main>
  );
}
