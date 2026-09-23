# Local run — commands

Run **every command from the project folder** (the folder that contains `package.json`).  
Need **Node.js 20+**. Check: `node -v`

---

## 1. Clone and enter the folder

```bash
git clone https://github.com/zk-007/Gibc_hackathon.git
cd Gibc_hackathon
```

If the folder name is different after clone, `cd` into that name instead.

---

## 2. Install

```bash
npm install
```

---

## 3. Env file

**PowerShell (Windows):**

```powershell
Copy-Item .env.example .env.local
```

**Mac / Linux:**

```bash
cp .env.example .env.local
```

`.env.local` is enough to open the UI. Mail stays mock. No Google Sheet / Gmail / Groq required for a first look.

Optional later (edit `.env.local`, never commit it):

| Want | Add |
| --- | --- |
| AI writes workflow + email drafts | `FLOWFORGE_LLM_KEY` + Groq URL/model from `.env.example` |
| Real sheet leads | `SHEETS_CSV_URL` (Share → Anyone with the link, Viewer) |
| Real Gmail | `FLOWFORGE_MAIL=gmail`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| Demo reminder in 1 minute | `FLOWFORGE_FOLLOWUP_MS=60000` |

---

## 4. Tests (optional)

```bash
npm test
```

---

## 5. Start the app

```bash
npm run dev
```

Leave this terminal open. Browser:

**http://localhost:3000**

Click: **Workflow → Test → Report → Approvals → Activity**

Stop: in that terminal, `Ctrl+C`.

---

## If it does not start

- You are not in the folder with `package.json` — `cd` there, then `npm run dev` again.
- Port 3000 busy — close the other app using 3000, or wait; Next will print another port.
- `npm` not found — install Node.js LTS, close and reopen the terminal.
