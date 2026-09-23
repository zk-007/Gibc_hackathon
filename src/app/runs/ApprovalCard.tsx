"use client";

import { useState } from "react";
import {
  actionApprove,
  actionEditPreview,
  actionPostpone,
  actionSkip,
} from "./actions";
import type { RunSnapshot } from "@/runs/memoryStore";

export function ApprovalCard({ run }: { run: RunSnapshot }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(run.subject);
  const [body, setBody] = useState(run.body);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <article className="card">
      <h3 style={{ margin: "0 0 0.35rem" }}>Send to {run.email}</h3>
      <p style={{ margin: "0 0 0.75rem", color: "var(--muted)" }}>
        {run.company}
        {run.previewSource === "llm" ? " · written by AI" : ""}
      </p>
      {editing ? (
        <form
          action={async (formData) => {
            await actionEditPreview(
              run.id,
              String(formData.get("subject") ?? ""),
              String(formData.get("body") ?? ""),
            );
            setEditing(false);
          }}
        >
          <p>
            <input
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </p>
          <p>
            <textarea
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
            />
          </p>
          <button type="submit">Save preview</button>
        </form>
      ) : (
        <>
          <p>
            <strong>Subject:</strong> {run.subject}
          </p>
          <p style={{ color: "var(--muted)" }}>{run.body}</p>
        </>
      )}
      <p className="row" style={{ marginTop: "0.75rem" }}>
        <button type="button" disabled={busy} onClick={() => actionSkip(run.id)}>
          Reject
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => actionPostpone(run.id, 60)}
        >
          Postpone
        </button>
        <button type="button" onClick={() => setEditing((value) => !value)}>
          Edit
        </button>
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const result = await actionApprove(run.id);
            setBusy(false);
            if (result && "ok" in result && !result.ok) {
              setError(result.error);
            }
          }}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </p>
      {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
    </article>
  );
}
