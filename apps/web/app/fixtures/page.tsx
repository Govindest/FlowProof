import Link from "next/link";
import { FixtureControls } from "../../components/fixture-controls";

export default function Page() {
  return (
    <main>
      <div className="crumbs">
        <Link href="/">Workflows</Link>
        <span>›</span>
        <span>Fixture control</span>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">DETERMINISTIC DEMO</p>
          <h1>Inject failure on demand.</h1>
          <p>
            Each switch activates one known regression. Next run captures exact
            failure evidence.
          </p>
        </div>
      </div>
      <div className="notice">
        <strong>Judge mode:</strong> run clean once for baseline, inject one
        regression, then verify again and open Compare runs.
      </div>
      <FixtureControls />
    </main>
  );
}
