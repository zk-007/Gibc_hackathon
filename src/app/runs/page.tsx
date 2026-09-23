import { actionResume, actionSeedRuns } from "./actions";
import { ApprovalCard } from "./ApprovalCard";
import { gmailDeliveryMode } from "@/connectors/gmail";
import { followUpExplain } from "@/jobs/delayCopy";
import { listFollowUps, processDueFollowUps } from "@/jobs/followups";
import { getRunConnectors, listRunBoard, seedDemoRuns } from "@/runs/memoryStore";
import { runStatusLabel } from "@/simulate/labels";
import { describeLeadSource } from "@/triggers/loadLeadsCsv";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  await seedDemoRuns();
  await processDueFollowUps((email) => getRunConnectors().gmail.send(email));
  const board = listRunBoard();
  const followups = listFollowUps();
  const deliver = gmailDeliveryMode();

  return (
    <main className="wrap">
      <h1>Approvals</h1>
      <p className="lede">Emails from your leads. Nothing goes out until you say yes.</p>

      <div className="metrics">
        <div className="metric">
          <b>{board.pending.length}</b>
          <span>waiting</span>
        </div>
        <div className="metric">
          <b>{board.blocked}</b>
          <span>stopped</span>
        </div>
        <div className="metric">
          <b>{board.emailsSent}</b>
          <span>sent</span>
        </div>
      </div>
      <p className="mono" style={{ color: "var(--muted)" }}>
        {describeLeadSource().startsWith("Google")
          ? "Connected to Google Sheet"
          : "Using sample leads"}
        {deliver === "live" ? " · sending live" : ""}
      </p>

      <h2>Waiting</h2>
      {board.pending.length === 0 ? (
        <p className="lede">No emails waiting.</p>
      ) : (
        board.pending.map((run) => <ApprovalCard key={run.id} run={run} />)
      )}

      {board.postponed.length > 0 ? (
        <>
          <h2>Later</h2>
          {board.postponed.map((run) => (
            <div className="card" key={run.id}>
              <strong>{run.email || run.leadName}</strong>
              <p style={{ color: "var(--muted)", margin: "0.35rem 0 0.6rem" }}>
                Comes back in{" "}
                {Math.max(
                  0,
                  Math.round(((run.snoozeUntil ?? 0) - Date.now()) / 60000),
                )}{" "}
                min.
              </p>
              <form action={actionResume.bind(null, run.id)}>
                <button type="submit">Bring back now</button>
              </form>
            </div>
          ))}
        </>
      ) : null}

      <h2>Leads</h2>
      <ul style={{ paddingLeft: "1.1rem", color: "var(--muted)" }}>
        {board.recent.map((run) => (
          <li key={run.id} style={{ marginBottom: "0.45rem" }}>
            <strong className={`status-${run.status}`}>
              {run.email || run.leadName}
            </strong>{" "}
            — {runStatusLabel(run.status)}
          </li>
        ))}
      </ul>

      <h2>Reminders</h2>
      {followups.length === 0 ? (
        <p className="lede">None yet. They appear after you send a welcome.</p>
      ) : (
        followups.map((job) => (
          <div className="card" key={job.id}>
            <strong>
              {job.name || job.email} · {job.status}
            </strong>
            <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>
              {followUpExplain(job)}
              {job.status === "scheduled"
                ? ` ${Math.max(0, Math.round((job.dueAt - Date.now()) / 1000))}s left.`
                : ""}
            </p>
          </div>
        ))
      )}

      <form action={actionSeedRuns}>
        <button type="submit">Clear sample leads</button>
      </form>
    </main>
  );
}
