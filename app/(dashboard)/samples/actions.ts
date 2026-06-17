"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/profile";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseSampleCsvMetadata } from "@/lib/data-hub/samples";
import type { SampleCsvSourceType } from "@/lib/data-hub/samples";

export type UploadSampleResult =
  | { ok: true; id: string; rowCount: number; columnCount: number }
  | { error: string };

export async function uploadSampleCsv(formData: FormData): Promise<UploadSampleResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };

  const fileName = file.name;
  if (!fileName.toLowerCase().endsWith(".csv")) {
    return { error: "Only CSV files are supported." };
  }

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Label is required." };

  const sourceType = String(formData.get("source_type") ?? "").trim();
  if (
    sourceType !== "projects_sheet" &&
    sourceType !== "terros_export" &&
    sourceType !== "remittance"
  ) {
    return { error: "Choose a source type." };
  }

  const content = await file.text();
  if (!content.trim()) return { error: "File is empty." };

  const { column_headers, row_count } = parseSampleCsvMetadata(content);
  if (column_headers.length === 0) {
    return { error: "Could not parse CSV headers." };
  }

  const installer = String(formData.get("installer") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  try {
    const db = createServerSupabase();
    const { data, error } = await db
      .from("sample_csv_files")
      .insert({
        label,
        source_type: sourceType as SampleCsvSourceType,
        installer,
        file_name: fileName,
        file_content: content,
        row_count,
        column_headers,
        notes,
        uploaded_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/samples");

    return {
      ok: true,
      id: String(data.id),
      rowCount: row_count,
      columnCount: column_headers.length,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export async function deleteSampleCsv(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  try {
    const db = createServerSupabase();
    const { error } = await db.from("sample_csv_files").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/samples");
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Delete failed.",
    };
  }
}
