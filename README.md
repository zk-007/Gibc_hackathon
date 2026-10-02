# FlowForge Guardian

Turn one plain-language instruction into a workflow that **cannot** email a customer
until a human approves it.

Most "AI automation" demos connect a sheet to Gmail and hope the model behaves.
FlowForge Guardian assumes the model will get it wrong: the compiler's output is
validated against a strict schema, guard steps are re-injected even if the model
drops them, and every run is rehearsed on synthetic people before a single real
message is allowed out.

## The five screens

| Step | Page | What happens |
| --- | --- | --- |
| 1 | `/` Plan | You describe the routine. The compiler returns validated workflow JSON. |
| 2 | `/simulate` Practice | 20 synthetic leads run through the graph in dry-run. No real email. |
| 3 | `/report` Safety | Pass rate, violations, risk score, and whether activation is allowed. |
| 4 | `/runs` Real emails | Google Sheet rows wait here. You approve, edit, reject, or postpone. |
| 5 | `/audit` Audit | Every policy decision, approval, and send, with timestamps. |

## How a lead actually flows

```
Google Sheet row
   ↓  require_fields (email + name)
   ↓  policy: email.valid → consent.marketing → dedupe.email → discount.limit
   ↓  human approval gate      ← approve / edit / reject / postpone
   ↓  gmail.send               ← real Gmail, only after approval + execute
   ↓  tasks.create (P3D)       ← follow-up email 3 days later
audit log
```

A lead with no consent never reaches the gate, so no Approve button is offered.
A duplicate address goes to review. A malformed address is blocked. A row that
offers more than `FLOWFORGE_MAX_DISCOUNT` percent is blocked.

Approval and execution are two separate stages. `approve` only records the
decision; the send happens in `execute`. The Approve & send button runs both so
a demo stays one click.

## Architecture

| Layer | Implementation |
| --- | --- |
| UI | Next.js 15 App Router, server components, CSS (reduced-motion aware) |
| API | Next.js route handlers in `src/app/api/**`, logic in `src/http/handlers.ts` |
| Compiler | `src/agent/compile.ts` — LLM when a key is set, deterministic rules otherwise |
| Guard | `src/agent/guard.ts` — re-injects check / policy / gate into any workflow |
| Schema | `src/workflow/schema.ts` — Zod; unknown step types are rejected |
| Policy | `src/policy/evaluate.ts` — valid email, consent, duplicate, discount limit |
| Sandbox | `src/simulate/**` — synthetic leads, mock connectors, no side effects |
| Scoring | `src/report/buildSafetyReport.ts` |
| Execution | `src/engine/execute.ts` + `src/connectors/gmail.ts` (Nodemailer) |
| Scheduler | `src/jobs/followups.ts`, background loop in `src/jobs/loop.ts` |
| Audit | `src/audit/log.ts` |
| Storage | JSON files under `data/` (prototype; swap for Postgres later) |

## Setup

```bash
npm install
npm test          # 73 tests
npm run dev       # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in what you need. Everything is
optional — with no configuration the app runs on mock connectors and built-in
rules.

| Variable | Effect |
| --- | --- |
| `FLOWFORGE_LLM_KEY` | Enables the LLM compiler **and** welcome/follow-up email drafts. Without it, rules + templates are used. |
| `FLOWFORGE_LLM_MODEL` | Defaults to `gpt-4o-mini`. |
| `FLOWFORGE_MAIL=gmail` | Turns on real sending via Nodemailer. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail account plus a 16-character App Password. |
| `GMAIL_DELIVER` | `redirect` (default, safe for testing) or `live` (mails the actual lead). |
| `GMAIL_REDIRECT_TO` | Where redirected test mail lands. |
| `SHEETS_CSV_URL` | Google Sheet link (share as *Anyone with the link → Viewer*). |
| `FLOWFORGE_FOLLOWUP_MS` | Demo override for the follow-up wait. `60000` = 1 minute. |
| `FLOWFORGE_LOOP_MS` | Background sync/follow-up interval. `off` disables the loop. |
| `FLOWFORGE_MAX_DISCOUNT` | Discount ceiling in percent. Defaults to `20`. |

Sheet columns: `id, name, email, company, consentMarketing, discount` (the
discount column is optional).

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/compile` | Instruction → validated workflow JSON |
| `POST /api/simulate` | Workflow → dry-run results and metrics |
| `GET` \| `POST /api/report` | Safety report for the active workflow |
| `POST /api/triggers/sync` | Pull sheet rows (body CSV, URL, or `SHEETS_CSV_URL`) |
| `GET /api/runs` | Pending, postponed, recent, sent, blocked |
| `POST /api/approvals/:id` | `{"decision":"approve"\|"reject"\|"postpone"\|"resume"}` |
| `POST /api/execute/:id` | Run the actions of an approved run |
| `POST /api/runs/:id/approve` \| `/skip` \| `/preview` | Shortcuts used by the UI |
| `POST /api/followups/tick` | Send any follow-up that is due |
| `GET /api/audit` | Audit events |
| `GET /api/gmail/status`, `GET /api/triggers/status` | Current delivery and lead source |

## Limitations

- The action vocabulary is `gmail.send` and `tasks.create` only. Slack, CRM, and
  invoices are not implemented.
- Storage is JSON on disk. There are no user accounts; one shared workspace.
- The safety score is a **prototype heuristic on synthetic data**, not a
  certified safety or compliance assessment.
- Sends are not reversible once approved. There is no undo, only an audit entry.
- The follow-up scheduler runs in-process; it only fires while the server is up.
- Google Sheets is read through published CSV, not the authenticated API.

## Synthetic data disclosure

Every record on the Practice and Safety screens is generated by
`src/simulate/generateLeads.ts`. Names, addresses, and companies are fake, and
the sandbox uses mock connectors, so no message can leave during simulation.
The only real recipients are rows in your own Google Sheet, and they are mailed
only after you press **Approve & send**.                                                                                                   Team & Contributors                                                                                                                        Mehr Zainab: animations polish, UI design, testing
