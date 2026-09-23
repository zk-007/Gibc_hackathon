import { readFile } from "node:fs/promises";
import path from "node:path";

export function defaultLeadsFile(): string {
  return path.join(process.cwd(), "data", "leads.csv");
}

export function configuredSheetUrl(): string | null {
  const raw = process.env.SHEETS_CSV_URL?.trim();
  return raw ? toSheetCsvUrl(raw) : null;
}

export function describeLeadSource(): string {
  if (configuredSheetUrl()) return "Google Sheet (SHEETS_CSV_URL)";
  return `local file (${defaultLeadsFile()})`;
}

/** Share/edit Google Sheet link → CSV export URL. Already-csv URLs pass through. */
export function toSheetCsvUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;

  const published = raw.match(/\/spreadsheets\/d\/e\/([^/?#]+)/i);
  if (published) {
    if (/output=csv/i.test(raw)) return raw;
    return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv`;
  }

  const file = raw.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9-_]+)/i);
  if (file) {
    if (/export\?format=csv/i.test(raw) || /output=csv/i.test(raw)) return raw;
    const gid = raw.match(/[?&#]gid=([0-9]+)/i)?.[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${file[1]}/export?format=csv&gid=${gid}`;
  }

  return raw;
}

export async function fetchPublishedSheetCsv(url: string): Promise<string> {
  const csvUrl = toSheetCsvUrl(url);
  const response = await fetch(csvUrl, {
    headers: { Accept: "text/csv,text/plain;q=0.9" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `Sheet CSV fetch failed (${response.status}). The sheet must be shared as Anyone with the link (Viewer).`,
    );
  }
  const text = await response.text();
  if (/<html[\s>]/i.test(text) && !text.includes(",")) {
    throw new Error(
      "Google returned HTML instead of CSV. Set the sheet to Share → Anyone with the link (Viewer), or use File → Share → Publish to web (CSV).",
    );
  }
  return text;
}

export async function loadLeadsCsvText(source: {
  csv?: string;
  url?: string;
  filePath?: string;
}): Promise<{ text: string; origin: string }> {
  if (source.csv?.trim()) {
    return { text: source.csv, origin: "body" };
  }
  if (source.url?.trim()) {
    const url = toSheetCsvUrl(source.url);
    return { text: await fetchPublishedSheetCsv(url), origin: url };
  }
  const envUrl = configuredSheetUrl();
  if (envUrl) {
    return { text: await fetchPublishedSheetCsv(envUrl), origin: envUrl };
  }
  const filePath = source.filePath ?? defaultLeadsFile();
  try {
    const text = await readFile(filePath, "utf8");
    return { text, origin: filePath };
  } catch {
    throw new Error(
      "No lead source: send csv, a Google Sheet url, SHEETS_CSV_URL, or add data/leads.csv",
    );
  }
}
