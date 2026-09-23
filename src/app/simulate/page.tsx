import Link from "next/link";
import { Pipeline } from "../Pipeline";
import { compileBrief } from "@/agent/compileBrief";
import { getActiveBrief, getActiveWorkflow } from "@/session/activeBrief";
import { generateLeads } from "@/simulate/generateLeads";
import { simulateWorkflow } from "@/simulate/runSandbox";
import { scenarioLabel, statusLabel } from "@/simulate/labels";
import { trafficByNode } from "@/simulate/traffic";
import { actionResimulate } from "./actions";

export const dynamic = "force-dynamic";

export default async function SimulatePage() {
  const workflow = getActiveWorkflow() ?? compileBrief(getActiveBrief()).workflow;
  const sandbox = await simulateWorkflow(workflow, generateLeads());
  const traffic = trafficByNode(workflow, sandbox);

  return (
    <main className="wrap">
      <h1>Test</h1>
      <p className="lede">Sample leads only. No real emails go out.</p>

      <div className="metrics">
        <div className="metric">
          <b>{sandbox.passed}</b>
          <span>ready for you</span>
        </div>
        <div className="metric">
          <b>{sandbox.blocked}</b>
          <span>stopped</span>
        </div>
        <div className="metric">
          <b>{sandbox.review}</b>
          <span>duplicates</span>
        </div>
        <div className="metric">
          <b>{sandbox.emailsSent}</b>
          <span>emails sent</span>
        </div>
      </div>

      <h2>Steps</h2>
      <Pipeline
        nodes={workflow.nodes}
        trigger={workflow.trigger}
        traffic={traffic}
      />

      <h2>Sample leads</h2>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Situation</th>
              <th>Result</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {sandbox.cases.map((item) => (
              <tr key={item.leadId}>
                <td className="mono">{item.leadId}</td>
                <td>{scenarioLabel(item.scenario)}</td>
                <td className={`status-${item.status}`}>
                  {statusLabel(item.status)}
                </td>
                <td style={{ color: "var(--muted)" }}>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row">
        <form action={actionResimulate}>
          <button type="submit">Run again</button>
        </form>
        <Link href="/report">Report</Link>
        <Link href="/runs">Approvals</Link>
      </div>
    </main>
  );
}
