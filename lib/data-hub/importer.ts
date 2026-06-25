import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportSource } from "@/lib/data-hub/normalize";
import { mapProjectsSheetRow, mapRemittanceRow } from "@/lib/data-hub/mappers";
import { refreshNetEpcForProjects } from "@/lib/data-hub/remittance-project-sync";
import {
  findHeaderRowIndex,
  inferRemittancePaymentDate,
  parseCsv,
  rowsToRecords,
} from "@/lib/csv/parse";

export type ImportResult = {
  importId: string;
  rowCount: number;
  inserted: number;
  updated: number;
  matched: number;
  errors: number;
  errorMessages: string[];
};

const REMITTANCE_UPSERT_CHUNK = 100;
const PROJECT_LOOKUP_CHUNK = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

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
  const parsedRows = parseCsv(content);
  const headerIdx = findHeaderRowIndex(parsedRows);
  const rows = rowsToRecords(parsedRows);
  const rowCount = rows.length;
  const defaultPaymentDate =
    source === "remittance"
      ? inferRemittancePaymentDate(content, fileName)
      : null;

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
      // remittance — batch project lookups and upserts (one row-at-a-time is very slow)
      const affectedProjectIds = new Set<string>();
      const pendingRows: {
        csvRowNumber: number;
        mapped: NonNullable<ReturnType<typeof mapRemittanceRow>>;
      }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const csvRowNumber = headerIdx + 2 + i;
        const mapped = mapRemittanceRow(rows[i]!, csvRowNumber, {
          defaultPaymentDate,
        });
        if (!mapped) {
          errorMessages.push(`Row ${csvRowNumber}: missing HES Code`);
          continue;
        }
        pendingRows.push({ csvRowNumber, mapped });
      }

      const hesCodes = [...new Set(pendingRows.map((r) => r.mapped.hes_code))];
      const projectIdByHes = new Map<string, string>();

      for (const codeChunk of chunk(hesCodes, PROJECT_LOOKUP_CHUNK)) {
        const { data: projects, error: lookupErr } = await db
          .from("projects")
          .select("id, project_id")
          .in("project_id", codeChunk);

        if (lookupErr) {
          throw new Error(`Project lookup failed: ${lookupErr.message}`);
        }

        for (const project of projects ?? []) {
          if (project.project_id && project.id) {
            projectIdByHes.set(project.project_id, project.id);
          }
        }
      }

      const remittanceRows = pendingRows.map(({ csvRowNumber, mapped }) => {
        const projectId = projectIdByHes.get(mapped.hes_code) ?? null;
        if (projectId) {
          matched++;
          affectedProjectIds.add(projectId);
        }
        return {
          ...mapped,
          project_id: projectId,
          file_name: fileName,
          file_hash: fileHash,
          _csvRowNumber: csvRowNumber,
        };
      });

      for (const rowChunk of chunk(remittanceRows, REMITTANCE_UPSERT_CHUNK)) {
        const payload = rowChunk.map(({ _csvRowNumber: _, ...row }) => row);
        const { error } = await db.from("remittance").upsert(payload, {
          onConflict: "file_hash,row_number",
        });

        if (error) {
          for (const row of rowChunk) {
            errorMessages.push(`Row ${row._csvRowNumber}: ${error.message}`);
          }
          continue;
        }

        inserted += rowChunk.length;
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
