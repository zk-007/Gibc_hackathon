"use client";

import { useState } from "react";
import Link from "next/link";
import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import { Pipeline } from "./Pipeline";
import type { Workflow } from "@/workflow/schema";

type GenerateView = {
  workflow: Workflow;
  source: "llm" | "rules";
  ready: number;
  stopped: number;
};

const EXAMPLES = [
  GOLDEN_LEAD_BRIEF,
  "When a new lead is added to my Leads sheet, send them a welcome email.",
];

export function Builder() {
  const [brief, setBrief] = useState(GOLDEN_LEAD_BRIEF);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerateView | null>(null);

  async function generate(text: string) {
    setBusy(true);
    setError(null);
    try {
      const compileRes = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: text }),
      });
      const compiled = await compileRes.json();
      if (!compileRes.ok) {
        setResult(null);
        setError(compiled.error ?? "Could not build that workflow");
        return;
      }
      const simRes = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: text }),
      });
      const sandbox = await simRes.json();
      if (!simRes.ok) {
        setResult(null);
        setError(sandbox.error ?? "Test run failed");
        return;
      }
      setResult({
        workflow: compiled.workflow,
        source: compiled.source ?? "rules",
        ready: sandbox.passed,
        stopped: sandbox.blocked,
      });
    } catch {
      setResult(null);
      setError("The app is not running yet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>New lead, welcome email</h1>
      <p className="lede">Describe what should happen. Nothing is sent yet.</p>

      <label htmlFor="brief" className="kicker">
        Routine
      </label>
      <textarea
        id="brief"
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        rows={4}
        maxLength={500}
      />
      <p className="row">
        {EXAMPLES.map((example, index) => (
          <button key={example} type="button" onClick={() => setBrief(example)}>
            {index === 0 ? "Welcome + reminder" : "Welcome only"}
          </button>
        ))}
      </p>
      <p>
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={() => generate(brief)}
        >
          {busy ? "Building…" : "Create workflow"}
        </button>
      </p>
      {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}

      {result ? (
        <section>
          <h2>{result.workflow.name}</h2>
          <p className="lede">
            {result.source === "llm" ? "Written by AI." : "Built from your sentence."}{" "}
            {result.ready} sample leads would wait for you. {result.stopped} were
            stopped.
          </p>
          <Pipeline
            nodes={result.workflow.nodes}
            trigger={result.workflow.trigger}
          />
          <p className="row" style={{ marginTop: "1.2rem" }}>
            <Link href="/simulate">Test</Link>
            <Link href="/report">Report</Link>
            <Link href="/runs">Approvals</Link>
          </p>
        </section>
      ) : null}
    </main>
  );
}
