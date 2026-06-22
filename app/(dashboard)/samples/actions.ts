"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/profile";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseSampleCsvMetadata } from "@/lib/data-hub/samples";
import type { SampleCsvSourceType } from "@/lib/data-hub/samples";
import { parseCsv, rowsToRecords } from "@/lib/csv/parse";
import { applyMapping } from "@/lib/data-hub/field-mapper";
import type { MappingTemplate } from "@/lib/data-hub/mapping-templates";

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

export type ImportWithMappingResult =
  | { inserted: number; updated: number; errors: number; errorMessages: string[] }
  | { error: string };

export async function importWithMapping(
  formData: FormData
): Promise<ImportWithMappingResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  const content = formData.get("content");
  const fileName = formData.get("fileName");
  const mappingRaw = formData.get("mapping");
  const schema = (formData.get("schema") ?? "projects") as "projects" | "remittance";
  const installer = String(formData.get("installer") ?? "").trim() || null;

  if (typeof content !== "string" || !content.trim())
    return { error: "No CSV content." };
  if (typeof mappingRaw !== "string") return { error: "No mapping provided." };

  let mapping: Record<string, string>;
  try {
    mapping = JSON.parse(mappingRaw) as Record<string, string>;
  } catch {
    return { error: "Invalid mapping JSON." };
  }

  const rows = rowsToRecords(parseCsv(content));
  if (rows.length === 0) return { error: "CSV has no data rows." };

  const db = createServerSupabase();
  let inserted = 0;
  let updated = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const patch = applyMapping(rows[i]!, mapping, schema);

    if (schema === "remittance") {
      const hesCode = patch.hes_code as string | undefined;
      const paymentDate = patch.payment_date as string | undefined;
      if (!hesCode || !paymentDate) {
        errorMessages.push(`Row ${i + 2}: missing HES Code or Payment Date — skipped`);
        continue;
      }

      // Link to project if possible
      const { data: project } = await db
        .from("projects")
        .select("id")
        .eq("project_id", hesCode)
        .maybeSingle();

      const fileHash = String(fileName ?? "manual") + "-" + Date.now();
      const remittanceRow = {
        ...patch,
        project_id: project?.id ?? null,
        file_name: String(fileName ?? "manual"),
        file_hash: fileHash,
        row_number: i + 2,
        raw_row: rows[i],
      };

      const { error } = await db.from("remittance").insert(remittanceRow);
      if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
      else inserted++;
    } else {
      const projectId = patch.project_id as string | undefined;
      if (!projectId) {
        errorMessages.push(`Row ${i + 2}: missing Project ID — skipped`);
        continue;
      }

      patch.updated_at = new Date().toISOString();
      if (installer) patch.installer = installer;

      const { data: existing } = await db
        .from("projects")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from("projects")
          .update(patch)
          .eq("id", existing.id);
        if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
        else updated++;
      } else {
        const { error } = await db.from("projects").insert(patch);
        if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
        else inserted++;
      }
    }
  }

  revalidatePath("/projects");

  return {
    inserted,
    updated,
    errors: errorMessages.length,
    errorMessages: errorMessages.slice(0, 20),
  };
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

export async function saveMappingTemplate(formData: FormData): Promise<
  { ok: true; id: string } | { error: string }
> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Template name is required." };

  const schemaType = formData.get("schema_type");
  if (schemaType !== "projects" && schemaType !== "remittance") {
    return { error: "Invalid schema type." };
  }

  const mappingRaw = formData.get("column_map");
  if (typeof mappingRaw !== "string") return { error: "No column mapping." };

  let columnMap: Record<string, string>;
  try {
    columnMap = JSON.parse(mappingRaw) as Record<string, string>;
  } catch {
    return { error: "Invalid column mapping JSON." };
  }

  const installerName = String(formData.get("installer_name") ?? "").trim() || null;
  const templateId = String(formData.get("id") ?? "").trim() || null;

  try {
    const db = createServerSupabase();
    const payload = {
      name,
      installer_name: installerName,
      schema_type: schemaType,
      column_map: columnMap,
      updated_at: new Date().toISOString(),
    };

    if (templateId) {
      const { error } = await db
        .from("mapping_templates")
        .update(payload)
        .eq("id", templateId);
      if (error) throw new Error(error.message);
      revalidatePath("/imports");
      return { ok: true, id: templateId };
    }

    const { data, error } = await db
      .from("mapping_templates")
      .insert({ ...payload, created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/imports");
    return { ok: true, id: String(data.id) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

export async function deleteMappingTemplate(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  try {
    const db = createServerSupabase();
    const { error } = await db.from("mapping_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/imports");
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Delete failed.",
    };
  }
}

export async function fetchMappingTemplates(
  schemaType?: "projects" | "remittance",
  installerName?: string
): Promise<MappingTemplate[] | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  try {
    const db = createServerSupabase();
    let query = db
      .from("mapping_templates")
      .select("id, name, installer_name, schema_type, column_map, created_at")
      .order("created_at", { ascending: false });

    if (schemaType) query = query.eq("schema_type", schemaType);
    if (installerName?.trim()) query = query.eq("installer_name", installerName.trim());

    const { data, error } = await query;
    if (error) {
      if (error.message.includes("mapping_templates")) return [];
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      installer_name: row.installer_name != null ? String(row.installer_name) : null,
      schema_type: row.schema_type as "projects" | "remittance",
      column_map: (row.column_map ?? {}) as Record<string, string>,
      created_at: String(row.created_at),
    }));
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Load failed.",
    };
  }
}

export async function fetchInstallerNames(): Promise<string[] | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  try {
    const db = createServerSupabase();
    const { data, error } = await db.from("projects").select("installer");
    if (error) {
      if (error.message.includes("projects")) return [];
      throw new Error(error.message);
    }
    const { mergeInstallerOptions } = await import("@/lib/data-hub/installers");
    const fromDb = (data ?? [])
      .map((r) => (r.installer != null ? String(r.installer) : ""))
      .filter(Boolean);
    return mergeInstallerOptions(fromDb);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Load failed.",
    };
  }
}
