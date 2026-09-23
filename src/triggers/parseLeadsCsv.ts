import { LeadSchema, type Lead } from "@/workflow/schema";

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function headerKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, "");
}

function parseConsent(value: string): boolean | undefined {
  const text = value.trim().toLowerCase();
  if (!text) return undefined;
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return undefined;
}

const DEFAULT_INDEX = {
  id: 0,
  name: 1,
  email: 2,
  company: 3,
  consent: 4,
  discount: 5,
};

function parseDiscount(value: string | undefined): number | undefined {
  const text = (value ?? "").trim().replace("%", "");
  if (!text) return undefined;
  const num = Number(text);
  return Number.isFinite(num) ? num : undefined;
}

function looksLikeHeaderRow(headers: string[]): boolean {
  return (
    headers.includes("email") ||
    headers.includes("id") ||
    headers.includes("name") ||
    headers.includes("consentmarketing")
  );
}

/** One Leads sheet row → Lead. Columns: id, name, email, company, consent, discount. */
export function parseLeadsCsv(csv: string): Lead[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const first = splitCsvLine(lines[0]).map(headerKey);
  const hasHeader = looksLikeHeaderRow(first);
  const index = hasHeader
    ? {
        id: first.findIndex((h) => h === "id" || h === "rowid"),
        name: first.findIndex((h) => h === "name" || h === "fullname"),
        email: first.findIndex((h) => h === "email"),
        company: first.findIndex((h) => h === "company"),
        consent: first.findIndex(
          (h) =>
            h === "consentmarketing" || h === "consent" || h === "marketingconsent",
        ),
        discount: first.findIndex(
          (h) => h === "discount" || h === "discountpercent" || h === "offer",
        ),
      }
    : DEFAULT_INDEX;

  const leads: Lead[] = [];
  const start = hasHeader ? 1 : 0;

  for (let row = start; row < lines.length; row += 1) {
    const cells = splitCsvLine(lines[row]);
    const email = index.email >= 0 ? cells[index.email] ?? "" : "";
    const id =
      (index.id >= 0 ? cells[index.id] : "") ||
      email ||
      `row-${row}`;
    const parsed = LeadSchema.safeParse({
      id,
      name: index.name >= 0 ? cells[index.name] || undefined : undefined,
      email: email || undefined,
      company: index.company >= 0 ? cells[index.company] || undefined : undefined,
      consentMarketing:
        index.consent >= 0 ? parseConsent(cells[index.consent] ?? "") : undefined,
      discountPercent:
        index.discount >= 0 ? parseDiscount(cells[index.discount]) : undefined,
    });
    if (parsed.success) leads.push(parsed.data);
  }

  return leads;
}
