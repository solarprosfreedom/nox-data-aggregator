import { createServerSupabase } from "@/lib/supabase/server";
import type { SampleCsvDetail, SampleCsvListItem } from "@/lib/data-hub/samples";

const LIST_COLUMNS =
  "id, label, source_type, installer, file_name, row_count, column_headers, notes, created_at";

function mapListItem(row: Record<string, unknown>): SampleCsvListItem {
  const headers = row.column_headers;
  return {
    id: String(row.id),
    label: String(row.label),
    source_type: row.source_type as SampleCsvListItem["source_type"],
    installer: row.installer != null ? String(row.installer) : null,
    file_name: String(row.file_name),
    row_count: Number(row.row_count ?? 0),
    column_headers: Array.isArray(headers) ? headers.map(String) : null,
    notes: row.notes != null ? String(row.notes) : null,
    created_at: String(row.created_at),
  };
}

export async function listSampleCsvFiles(
  limit = 100
): Promise<SampleCsvListItem[]> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("sample_csv_files")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("sample_csv_files")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapListItem(row as Record<string, unknown>));
}

export async function getSampleCsvFile(id: string): Promise<SampleCsvDetail | null> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("sample_csv_files")
    .select(`${LIST_COLUMNS}, file_content`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...mapListItem(data as Record<string, unknown>),
    file_content: String((data as Record<string, unknown>).file_content),
  };
}

export async function deleteSampleCsvFile(id: string): Promise<void> {
  const db = createServerSupabase();
  const { error } = await db.from("sample_csv_files").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
