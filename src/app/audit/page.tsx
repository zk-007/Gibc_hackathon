import { listAudit } from "@/audit/log";

const ACTOR_LABEL: Record<string, string> = {
  human: "You",
  policy: "Rules",
  gmail: "Email",
  system: "App",
};

const ACTOR_COLOR: Record<string, string> = {
  human: "var(--green)",
  policy: "var(--amber)",
  gmail: "var(--blue)",
  system: "var(--muted)",
};

export const dynamic = "force-dynamic";

export default function AuditPage() {
  const events = listAudit();

  return (
    <main className="wrap">
      <h1>Activity</h1>
      <p className="lede">What happened, and who did it.</p>

      {events.length === 0 ? (
        <p className="lede">Nothing yet.</p>
      ) : (
        <ol className="pipeline">
          {events.map((event) => (
            <li className="step" key={event.id}>
              <div
                className="kind"
                style={{ color: ACTOR_COLOR[event.actor] ?? "var(--muted)" }}
              >
                {ACTOR_LABEL[event.actor] ?? event.actor}
              </div>
              <div>
                <h3>
                  {event.event} — {event.lead}
                </h3>
                <p>
                  {event.detail}
                  <br />
                  <span className="mono">
                    {new Date(event.at).toLocaleString()}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
