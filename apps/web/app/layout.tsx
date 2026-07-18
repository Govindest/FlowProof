import Link from "next/link";
import { Mark } from "../components/ui";
import { backendStatus } from "../lib/backend";
import "./styles.css";

export const metadata = {
  title: "FlowProof",
  description: "Proof for critical browser workflows",
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backend = await backendStatus();
  const live = backend.llmMode === "live";
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside>
            <Link className="logo" href="/">
              <Mark />
              <strong>FlowProof</strong>
            </Link>
            <nav aria-label="Primary">
              <Link href="/">
                <span>⌂</span> Workflows
              </Link>
              <Link href="/runbooks/new">
                <span>＋</span> New runbook
              </Link>
              <Link href="/fixtures">
                <span>⚙</span> Fixture control
              </Link>
              <Link href="/setup">
                <span>⌁</span> Integrations
              </Link>
            </nav>
            <div className="sidebar-foot">
              <span className="mode-dot" /> {live ? "Live" : "Seeded"} GPT-5.6
              <br />
              <small>
                {live ? "Evidence diagnosis" : "Deterministic · No key"}
              </small>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <span className="mobile-logo">
                <Mark /> FlowProof
              </span>
              <div className="environment">
                <span className={backend.connected ? "" : "offline"} />
                {backend.connected
                  ? "Execution backend online"
                  : "Backend unavailable"}
              </div>
              <div className="avatar" aria-label="Operations team">
                OP
              </div>
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
