/** Strip UTF-8 BOM and normalize line endings for parsing. */
export function normalizeCsvText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Guess delimiter by scanning all lines for the most consistent separator count. */
export function detectCsvDelimiter(text: string): string {
  const lines = text.split("\n").slice(0, 5).filter((l) => l.trim());
  let tabs = 0, semis = 0, commas = 0;
  for (const line of lines) {
    tabs += (line.match(/\t/g) ?? []).length;
    semis += (line.match(/;/g) ?? []).length;
    commas += (line.match(/,/g) ?? []).length;
  }
  if (tabs >= 2 && tabs >= commas) return "\t";
  if (semis >= 2 && semis > commas) return ";";
  return ",";
}

/**
 * Known header names that indicate a row is a real column-header row.
 * We scan forward to skip metadata/title rows that many exporters prepend.
 */
const KNOWN_HEADERS = new Set([
  "hes id", "hes code", "hes_id", "project_id",
  "opportunity name", "first name", "last name",
  "project stage", "sales advisor",
]);

/**
 * Find the index of the first row that looks like a header row.
 * Falls back to 0 (first row) if none found within the first 10 rows.
 */
export function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i]!.map((c) => c.trim().toLowerCase());
    if (cells.some((c) => KNOWN_HEADERS.has(c))) return i;
  }
  return 0;
}

/** Parse delimited text with quoted fields (comma, tab, or semicolon). */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const normalized = normalizeCsvText(text);
  const sep = delimiter ?? detectCsvDelimiter(normalized);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]!;
    const next = normalized[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  const headerIdx = findHeaderRowIndex(rows);
  if (rows.length <= headerIdx + 1) return [];
  const headers = rows[headerIdx]!.map((h) =>
    h.trim().replace(/^\uFEFF/, "").replace(/\s+/g, " ")
  );
  const out: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i]!;
    if (!cells.some((c) => c.trim())) continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, j) => {
      rec[h] = (cells[j] ?? "").trim();
    });
    out.push(rec);
  }
  return out;
}

export function pickField(
  row: Record<string, string>,
  ...names: string[]
): string {
  for (const name of names) {
    const exact = row[name];
    if (exact?.trim()) return exact.trim();
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.trim().toLowerCase() === lower && v.trim()) return v.trim();
    }
  }
  return "";
}

export function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseNumeric(value: string): number | null {
  const v = value.replace(/[$,\s]/g, "").trim();
  if (!v || v === "-") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
