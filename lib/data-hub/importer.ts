import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportSource } from "@/lib/data-hub/normalize";
import { mapProjectsSheetRow, mapRemittanceRow } from "@/lib/data-hub/mappers";
import { refreshNetEpcForProjects } from "@/lib/data-hub/remittance-project-sync";
import { parseCsv, rowsToRecords } from "@/lib/csv/parse";

export type ImportResult = {
  importId: string;
  rowCount: number;
  inserted: number;
  updated: number;
  matched: number;
  errors: number;
  errorMessages: string[];
};

export async function processImport(options: {
  db: SupabaseClient;
  source: ImportSource;
  fileName: string;
  fileHash: string;
  content: string;
  uploadedBy?: string;
  installer?: string | null;
}): Promise<ImportResult> {
  const { db, source, fileName, fileHash, content, uploadedBy, installer } = options;
  const batchInstaller = installer?.trim() || null;

  if (source !== "projects_sheet" && source !== "remittance") {
    throw new Error("Only projects sheet and remittance imports are enabled.");
  }

  const errorMessages: string[] = [];
  let inserted = 0;
  let updated = 0;
  let matched = 0;

  // Remove any previous failed/partial log for this file so retries work.
  await db
    .from("hub_import_log")
    .delete()
    .eq("source", source)
    .eq("file_hash", fileHash)
    .in("status", ["failed", "partial"]);

  const { data: logRow, error: logErr } = await db
    .from("hub_import_log")
    .insert({
      source,
      file_name: fileName,
      file_hash: fileHash,
      status: "processing",
      uploaded_by: uploadedBy ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (logErr) {
    if (logErr.code === "23505") {
      throw new Error(
        "This file was already successfully imported. Re-export a fresh copy to re-import."
      );
    }
    throw new Error(logErr.message);
  }

  const importId = logRow.id as string;
  const rows = rowsToRecords(parseCsv(content));
  const rowCount = rows.length;

  try {
    if (source === "projects_sheet") {
      for (let i = 0; i < rows.length; i++) {
        const mapped = mapProjectsSheetRow(rows[i]!);
        if (!mapped) {
          errorMessages.push(`Row ${i + 2}: missing HES ID / project_id`);
          continue;
        }

        if (batchInstaller) mapped.installer = batchInstaller;

        const { data: existing } = await db
          .from("projects")
          .select("id")
          .eq("project_id", mapped.project_id)
          .maybeSingle();

        if (existing) {
          const { error } = await db
            .from("projects")
            .update(mapped)
            .eq("id", existing.id);
          if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
          else updated++;
        } else {
          const { error } = await db.from("projects").insert(mapped);
          if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
          else inserted++;
        }
      }
    } else {
      // remittance
      const affectedProjectIds = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const mapped = mapRemittanceRow(rows[i]!, i + 2);
        if (!mapped) {
          errorMessages.push(`Row ${i + 2}: missing HES Code or Payment date`);
          continue;
        }

        // Try to link to an existing project by HES Code = project_id
        const { data: project } = await db
          .from("projects")
          .select("id")
          .eq("project_id", mapped.hes_code)
          .maybeSingle();

        if (project?.id) {
          matched++;
          affectedProjectIds.add(project.id);
        }

        const remittanceRow = {
          ...mapped,
          project_id: project?.id ?? null,
          file_name: fileName,
          file_hash: fileHash,
        };

        const { error } = await db.from("remittance").upsert(remittanceRow, {
          onConflict: "file_hash,row_number",
        });

        if (error) {
          errorMessages.push(`Row ${i + 2}: ${error.message}`);
          continue;
        }

        inserted++;
      }

      if (affectedProjectIds.size > 0) {
        await refreshNetEpcForProjects(db, [...affectedProjectIds]);
      }
    }

    const status =
      errorMessages.length === 0
        ? "completed"
        : errorMessages.length < rowCount
          ? "partial"
          : "failed";

    await db
      .from("hub_import_log")
      .update({
        row_count: rowCount,
        inserted_count: inserted,
        updated_count: updated,
        matched_count: matched,
        error_count: errorMessages.length,
        status,
        error_summary: errorMessages.slice(0, 20).join("; ") || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);

    return {
      importId,
      rowCount,
      inserted,
      updated,
      matched,
      errors: errorMessages.length,
      errorMessages,
    };
  } catch (err) {
    await db
      .from("hub_import_log")
      .update({
        status: "failed",
        error_summary: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);
    throw err;
  }
}
