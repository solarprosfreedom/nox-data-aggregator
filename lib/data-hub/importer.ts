import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportSource } from "@/lib/data-hub/normalize";
import { mapProjectsSheetRow, mapRemittanceRow } from "@/lib/data-hub/mappers";
import {
  buildProjectPersonalInfoSync,
} from "@/lib/data-hub/project-personal-sync";
import {
  findHeaderRowIndex,
  inferRemittancePaymentDate,
  parseCsv,
  rowsToRecords,
} from "@/lib/csv/parse";
import { REMITTANCE_FIELD_KEYS } from "@/lib/data-hub/field-mapper";
import {
  patchPublicDealFromHub,
  syncPublicDealFromHub,
} from "@/lib/data-hub/public-deals-sync";
import {
  listAllPublicDeals,
  installerToPublicDealVendor,
  publicDealProjectId,
  type PublicDealRow,
} from "@/lib/public-deals/client";
import { recordPublicImportLog } from "@/lib/public-imports/client";

export type ImportResult = {
  importId: string;
  rowCount: number;
  inserted: number;
  updated: number;
  matched: number;
  errors: number;
  errorMessages: string[];
};

function remittanceEndpointPatch(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (REMITTANCE_FIELD_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function indexEndpointRows(rows: PublicDealRow[]) {
  const byProjectId = new Map<string, PublicDealRow>();
  for (const row of rows) byProjectId.set(publicDealProjectId(row), row);
  return byProjectId;
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

  // Allow re-import of the same file (updates remittance rows in place).
  await db
    .from("hub_import_log")
    .delete()
    .eq("source", source)
    .eq("file_hash", fileHash);

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
  const endpointByProjectId = indexEndpointRows(await listAllPublicDeals());

  try {
    if (source === "projects_sheet") {
      for (let i = 0; i < rows.length; i++) {
        const mapped = mapProjectsSheetRow(rows[i]!);
        if (!mapped) {
          errorMessages.push(`Row ${i + 2}: missing HES ID / project_id`);
          continue;
        }

        if (batchInstaller) mapped.installer = batchInstaller;

        const existing = endpointByProjectId.get(mapped.project_id);
        const installerForRow = mapped.installer ?? existing?.installer ?? null;
        if (!installerForRow) {
          errorMessages.push(`Row ${i + 2}: installer is required for endpoint import`);
          continue;
        }

        try {
          await syncPublicDealFromHub({
            installer: installerForRow,
            project: mapped,
            source: {
              fileName,
              rowNumber: i + 2,
              rawRow: rows[i],
            },
          });
          if (existing) updated++;
          else {
            inserted++;
            endpointByProjectId.set(mapped.project_id, {
              vendor: "axia",
              installer: installerForRow,
              pk: "project_id",
              pk_value: mapped.project_id,
              project: mapped,
              remittance: null,
            } as PublicDealRow);
          }
        } catch (err) {
          errorMessages.push(
            `Row ${i + 2}: public deals sync — ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } else {
      // Remittance imports patch existing Lovable endpoint rows by project id.
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

      for (const { csvRowNumber, mapped } of pendingRows) {
        const existing = endpointByProjectId.get(mapped.hes_code) ?? null;
        const rawRow = mapped.raw_row as Record<string, string>;
        if (!existing) {
          errorMessages.push(
            `Row ${csvRowNumber}: project ${mapped.hes_code} not found in public deals endpoint`,
          );
          continue;
        }

        const { projectId: _projectId, ...projectPatch } = buildProjectPersonalInfoSync(
          mapped.hes_code,
          rawRow,
          mapped,
        );

        try {
          await patchPublicDealFromHub({
            installer: existing.installer,
            project: { project_id: mapped.hes_code, ...projectPatch },
            remittance: remittanceEndpointPatch(mapped),
            source: {
              fileName,
              rowNumber: csvRowNumber,
              rawRow,
            },
          });
          matched++;
          updated++;
        } catch (err) {
          errorMessages.push(
            `Row ${csvRowNumber}: public deals sync — ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
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

    const publicImportSource =
      source === "projects_sheet" ? installerToPublicDealVendor(batchInstaller) : null;
    if (publicImportSource) {
      await recordPublicImportLog({
        source: publicImportSource,
        row_count: rowCount,
        inserted_count: inserted,
        updated_count: updated,
        filename: fileName,
        trigger_source: "dashboard_csv_upload",
        error: errorMessages.slice(0, 20).join("; ") || undefined,
      });
    }

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
