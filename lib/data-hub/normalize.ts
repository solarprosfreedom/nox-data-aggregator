import { parseCsv } from "@/lib/csv/parse";

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
  const headers = rows[0]?.map((h) => h.trim()) ?? [];
  if (headers.length === 0) return fromName;

  if (
    headerMatches(headers, "payment date", "hes code", "payment this week") ||
    headerMatches(headers, "partner commission", "total sp paid", "c0", "c1")
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
