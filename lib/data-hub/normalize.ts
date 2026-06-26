import { findHeaderRowIndex, parseCsv } from "@/lib/csv/parse";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip address/team suffixes from opportunity names like "Jane Doe -123 Main St Sacramento-Team ()". */
export function customerDisplayName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const trimmed = name.trim();
  const idx = trimmed.search(/\s-/);
  const base = idx >= 0 ? trimmed.slice(0, idx) : trimmed;
  return base.trim() || null;
}

/** Parse a 2-letter US state code from a formatted address string. */
export function parseStateCode(
  ...sources: (string | null | undefined)[]
): string | null {
  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const value = raw.trim();

    const commaMatch = value.match(/,\s*([A-Z]{2})(?:\s*,|\s+\d{5}(?:-\d{4})?|\s*$)/);
    if (commaMatch?.[1]) return commaMatch[1];

    const spaceMatch = value.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
    if (spaceMatch?.[1]) return spaceMatch[1];
  }
  return null;
}

/** Infer CA from California ZIP codes when state is missing from source data. */
export function inferCaliforniaStateFromZip(
  zip: string | null | undefined
): string | null {
  const digits = (zip ?? "").replace(/\D/g, "").slice(0, 5);
  if (digits.length !== 5) return null;
  const n = Number(digits);
  if (n >= 90001 && n <= 96162) return "CA";
  return null;
}

export function resolveStateCode(row: {
  state_code?: string | null;
  address_line1?: string | null;
  opportunity_name?: string | null;
  postal_code?: string | null;
}): string | null {
  return (
    row.state_code?.trim() ||
    parseStateCode(row.address_line1, row.opportunity_name) ||
    inferCaliforniaStateFromZip(row.postal_code)
  );
}

export function normalizePostal(zip: string): string {
  return zip.replace(/\D/g, "").slice(0, 5);
}

export type ImportSource = "projects_sheet" | "terros_export" | "remittance";

export const IMPORT_SOURCE_LABELS: Record<ImportSource, string> = {
  projects_sheet: "Projects sheet",
  terros_export: "Terros export",
  remittance: "Remittance",
};

export function detectImportSource(fileName: string): ImportSource {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("remittance") ||
    lower.includes("payment") ||
    lower.includes("commission")
  ) {
    return "remittance";
  }
  if (lower.includes("terros")) return "terros_export";
  if (
    lower.includes("project") ||
    lower.includes("axia") ||
    lower.includes("tron") ||
    lower.includes("hes")
  ) {
    return "projects_sheet";
  }
  return "projects_sheet";
}

function headerMatches(headers: string[], ...needles: string[]): boolean {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  return needles.some((needle) => {
    const n = needle.toLowerCase();
    return normalized.some((h) => h === n || h.includes(n));
  });
}

/** Prefer column headers; fall back to filename. */
export function detectImportSourceFromCsv(
  content: string,
  fileName: string
): ImportSource {
  const fromName = detectImportSource(fileName);
  const rows = parseCsv(content);
  const headerIdx = findHeaderRowIndex(rows);
  const headers = rows[headerIdx]?.map((h) => h.trim()) ?? [];
  if (headers.length === 0) return fromName;

  if (
    headerMatches(headers, "payment date", "hes code", "payment this week") ||
    headerMatches(headers, "partner commission", "total sp paid", "gross ppw", "c0", "c1")
  ) {
    return "remittance";
  }

  if (
    headerMatches(
      headers,
      "accountid",
      "account id",
      "workflowstage",
      "owner.email",
      "resident.firstname",
      "resident.email"
    )
  ) {
    return "terros_export";
  }

  if (
    headerMatches(
      headers,
      "hes id",
      "project stage",
      "opportunity name",
      "sales advisor",
      "original contract signed"
    )
  ) {
    return "projects_sheet";
  }

  return fromName;
}

export async function hashFileContent(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
