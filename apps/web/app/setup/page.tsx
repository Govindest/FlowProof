import Link from "next/link";
import { SetupForm } from "../../components/setup-form";

export default function Page() {
  return (
    <main>
      <div className="crumbs">
        <Link href="/">Workflows</Link>
        <span>›</span>
        <span>Integrations</span>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">OPTIONAL INTEGRATIONS</p>
          <h1>Connect when ready.</h1>
          <p>
            Core verification stays local and free. Credentials only enable
            publishing.
          </p>
        </div>
      </div>
      <SetupForm />
      <section className="panel mock-details">
        <div>
          <span className="mode-dot" />
          <h2>GPT-5.6 runs in the execution backend</h2>
        </div>
        <p>
          Reports label live and deterministic seeded output explicitly. Set
          <code> FLOWPROOF_LLM_MODE=live</code> and <code>OPENAI_API_KEY</code>{" "}
          on Railway to use live GPT-5.6.
        </p>
      </section>
    </main>
  );
}
