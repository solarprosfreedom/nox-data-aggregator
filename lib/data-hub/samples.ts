import { parseCsv } from "@/lib/csv/parse";
import type { ImportSource } from "@/lib/data-hub/normalize";

export type SampleCsvSourceType = ImportSource;

export type SampleCsvListItem = {
  id: string;
  label: string;
  source_type: SampleCsvSourceType;
  installer: string | null;
  file_name: string;
  row_count: number;
  column_headers: string[] | null;
  notes: string | null;
  created_at: string;
};

export type SampleCsvDetail = SampleCsvListItem & {
  file_content: string;
};

export function parseSampleCsvMetadata(content: string) {
  const rows = parseCsv(content);
  const headers = rows[0]?.map((h) => h.trim()).filter(Boolean) ?? [];
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));
  return {
    column_headers: headers,
    row_count: dataRows.length,
  };
}

export function previewSampleRows(
  content: string,
  limit = 20
): { headers: string[]; rows: string[][] } {
  const parsed = parseCsv(content);
  if (parsed.length === 0) return { headers: [], rows: [] };
  const headers = parsed[0]!.map((h) => h.trim());
  const dataRows = parsed
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .slice(0, limit);
  return { headers, rows: dataRows };
}

export const SOURCE_TYPE_LABELS: Record<SampleCsvSourceType, string> = {
  projects_sheet: "Projects sheet",
  terros_export: "Terros export",
  remittance: "Remittance",
};
