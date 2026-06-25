"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/profile";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseSampleCsvMetadata } from "@/lib/data-hub/samples";
import type { SampleCsvSourceType } from "@/lib/data-hub/samples";
import { parseCsv, rowsToRecords } from "@/lib/csv/parse";
import {
  applyMapping,
  hasRemittancePatch,
  splitMappedPatch,
  type SchemaType,
} from "@/lib/data-hub/field-mapper";
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
  | {
      inserted: number;
      updated: number;
      remittanceInserted: number;
      remittanceUpdated: number;
      errors: number;
      errorMessages: string[];
    }
  | { error: string };

export async function importWithMapping(
  formData: FormData
): Promise<ImportWithMappingResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  const content = formData.get("content");
  const fileName = formData.get("fileName");
  const mappingRaw = formData.get("mapping");
  const schema = (formData.get("schema") ?? "projects") as SchemaType;
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
  let remittanceInserted = 0;
  let remittanceUpdated = 0;
  const errorMessages: string[] = [];
  const affectedProjectIds = new Set<string>();
  const importFileHash = `${String(fileName ?? "manual")}-${Date.now()}`;

  for (let i = 0; i < rows.length; i++) {
    const patch = applyMapping(rows[i]!, mapping, schema);

    if (schema === "remittance") {
      const hesCode = patch.hes_code as string | undefined;
      if (hesCode && !patch.project_id) patch.project_id = hesCode;
    }

    const { project: projectPatch, remittance: remittancePatch } = splitMappedPatch(patch);
    const projectId = projectPatch.project_id as string | undefined;

    if (!projectId?.trim()) {
      errorMessages.push(`Row ${i + 2}: missing Project ID / HES Code — skipped`);
      continue;
    }

    const normalizedProjectId = projectId.trim();
    projectPatch.project_id = normalizedProjectId;

    if (installer) projectPatch.installer = installer;

    const meaningfulProjectKeys = Object.keys(projectPatch).filter(
      (k) => k !== "project_id",
    );

    let projectUuid: string | null = null;

    const { data: existing } = await db
      .from("projects")
      .select("id")
      .eq("project_id", normalizedProjectId)
      .maybeSingle();

    if (existing?.id) {
      projectUuid = existing.id;
      if (meaningfulProjectKeys.length > 0) {
        projectPatch.updated_at = new Date().toISOString();
        const { project_id: _pid, ...projectUpdate } = projectPatch;
        const { error } = await db
          .from("projects")
          .update(projectUpdate)
          .eq("id", existing.id);
        if (error) {
          errorMessages.push(`Row ${i + 2}: ${error.message}`);
          continue;
        }
        updated++;
      }
    } else {
      projectPatch.updated_at = new Date().toISOString();
      const { data: created, error } = await db
        .from("projects")
        .insert(projectPatch)
        .select("id")
        .single();
      if (error) {
        errorMessages.push(`Row ${i + 2}: ${error.message}`);
        continue;
      }
      projectUuid = created.id as string;
      inserted++;
    }

    if (!projectUuid) continue;

    if (hasRemittancePatch(remittancePatch)) {
      remittancePatch.hes_code = normalizedProjectId;

      const { data: latestRows, error: latestErr } = await db.rpc(
        "latest_remittance_for_projects",
        { project_ids: [projectUuid] },
      );
      if (latestErr) {
        errorMessages.push(`Row ${i + 2}: remittance lookup failed — ${latestErr.message}`);
        continue;
      }

      const latest = (latestRows ?? [])[0] as { id?: string | number } | undefined;

      if (latest?.id != null) {
        const { error } = await db
          .from("remittance")
          .update(remittancePatch)
          .eq("id", latest.id);
        if (error) {
          errorMessages.push(`Row ${i + 2}: remittance update — ${error.message}`);
        } else {
          remittanceUpdated++;
          affectedProjectIds.add(projectUuid);
        }
      } else {
        const paymentDate =
          (remittancePatch.payment_date as string | undefined) ??
          new Date().toISOString().slice(0, 10);

        const { error } = await db.from("remittance").insert({
          ...remittancePatch,
          payment_date: paymentDate,
          project_id: projectUuid,
          file_name: String(fileName ?? "manual"),
          file_hash: importFileHash,
          row_number: i + 2,
          raw_row: rows[i],
        });
        if (error) {
          errorMessages.push(`Row ${i + 2}: remittance insert — ${error.message}`);
        } else {
          remittanceInserted++;
          affectedProjectIds.add(projectUuid);
        }
      }
    }
  }

  if (affectedProjectIds.size > 0) {
    const { refreshNetEpcForProjects } = await import(
      "@/lib/data-hub/remittance-project-sync"
    );
    await refreshNetEpcForProjects(db, [...affectedProjectIds]);
  }

  revalidatePath("/projects");

  return {
    inserted,
    updated,
    remittanceInserted,
    remittanceUpdated,
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
