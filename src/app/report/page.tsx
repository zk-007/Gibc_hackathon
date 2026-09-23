import Link from "next/link";
import { getActiveBrief } from "@/session/activeBrief";
import { reportFromBrief } from "@/report/fromBrief";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const { report } = await reportFromBrief(getActiveBrief());
  const pass = report.findings.filter((item) => item.tone === "pass");
  const watch = report.findings.filter((item) => item.tone === "watch");
  const fail = report.findings.filter((item) => item.tone === "fail");

  return (
    <main className="wrap">
      <h1>{report.safeToEnablePercent}% ready</h1>
      <div className={`meter ${report.risk}`}>
        <span style={{ width: `${report.safeToEnablePercent}%` }} />
      </div>
      <p className="lede">{report.recommendation}</p>

      <div className="metrics">
        <div className="metric">
          <b>
            {report.sandbox.passed}/{report.sandbox.tested}
          </b>
          <span>sample leads ready</span>
        </div>
        <div className="metric">
          <b>{report.risk}</b>
          <span>risk</span>
        </div>
        <div className="metric">
          <b>{report.humanGates}</b>
          <span>approval steps</span>
        </div>
      </div>

      <section>
        <h2>Looking good</h2>
        {pass.map((item) => (
          <div className="card" key={item.title}>
            <strong style={{ color: "var(--green)" }}>{item.title}</strong>
            <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>{item.detail}</p>
          </div>
        ))}
      </section>
      <section>
        <h2>Worth a look</h2>
        {watch.length === 0 ? (
          <p className="lede">Nothing extra to watch.</p>
        ) : (
          watch.map((item) => (
            <div className="card" key={item.title}>
              <strong style={{ color: "var(--amber)" }}>{item.title}</strong>
              <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>
                {item.detail} {item.fix}
              </p>
            </div>
          ))
        )}
      </section>
      {fail.length > 0 ? (
        <section>
          <h2>Fix before sending</h2>
          {fail.map((item) => (
            <div className="card" key={item.title}>
              <strong style={{ color: "var(--red)" }}>{item.title}</strong>
              <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>{item.detail}</p>
            </div>
          ))}
        </section>
      ) : null}

      <p className="row">
        <Link href="/simulate">Test</Link>
        <Link href="/runs">Approvals</Link>
      </p>
    </main>
  );
}
