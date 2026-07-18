import Link from "next/link";
import { RunbookEditor } from "../../../components/runbook-editor";

export default function Page() {
  return (
    <main>
      <div className="crumbs">
        <Link href="/">Workflows</Link>
        <span>›</span>
        <span>New runbook</span>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">RUNBOOK BUILDER</p>
          <h1>Define proof, not scripts.</h1>
          <p>Start with plain language or bring version-controlled YAML.</p>
        </div>
      </div>
      <RunbookEditor />
      <p className="notice page-note">
        <strong>Credentials stay references.</strong> FlowProof resolves secrets
        at runtime; runbooks never contain raw credentials.
      </p>
    </main>
  );
}
