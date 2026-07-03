import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportSource } from "@/lib/data-hub/normalize";
import { mapProjectsSheetRow, mapRemittanceRow } from "@/lib/data-hub/mappers";
import {
  refreshNetEpcForProjects,
} from "@/lib/data-hub/remittance-project-sync";
import {
  buildProjectPersonalInfoSync,
  syncProjectPersonalInfoFromImport,
  type ProjectPersonalInfoSync,
} from "@/lib/data-hub/project-personal-sync";
import { omitEmptyPatchFields, remittanceUpsertPayload } from "@/lib/data-hub/remittance-upsert";
import {
  findHeaderRowIndex,
  inferRemittancePaymentDate,
  parseCsv,
  rowsToRecords,
} from "@/lib/csv/parse";
import { REMITTANCE_FIELD_KEYS } from "@/lib/data-hub/field-mapper";
import { syncPublicDealFromHub } from "@/lib/data-hub/public-deals-sync";

export type ImportResult = {
  importId: string;
  rowCount: number;
  inserted: number;
  updated: number;
  matched: number;
  errors: number;
  errorMessages: string[];
};

const PROJECT_LOOKUP_CHUNK = 200;

function remittanceEndpointPatch(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (REMITTANCE_FIELD_KEYS.has(key)) out[key] = value;
  }
  return out;
}

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
          .select("id, installer")
          .eq("project_id", mapped.project_id)
          .maybeSingle();

        if (existing) {
          const { project_id: _pid, ...rest } = mapped;
          const projectUpdate = omitEmptyPatchFields(rest);
          if (Object.keys(projectUpdate).length === 0) continue;

          projectUpdate.updated_at = new Date().toISOString();
          const { error } = await db
            .from("projects")
            .update(projectUpdate)
            .eq("id", existing.id);
          if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
          else {
            updated++;
            try {
              await syncPublicDealFromHub({
                installer:
                  mapped.installer ??
                  (existing.installer != null ? String(existing.installer) : null),
                project: mapped,
                source: {
                  fileName,
                  rowNumber: i + 2,
                  rawRow: rows[i],
                },
              });
            } catch (err) {
              errorMessages.push(
                `Row ${i + 2}: public deals sync — ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            }
          }
        } else {
          const { error } = await db.from("projects").insert(mapped);
          if (error) errorMessages.push(`Row ${i + 2}: ${error.message}`);
          else {
            inserted++;
            try {
              await syncPublicDealFromHub({
                installer: mapped.installer,
                project: mapped,
                source: {
                  fileName,
                  rowNumber: i + 2,
                  rawRow: rows[i],
                },
              });
            } catch (err) {
              errorMessages.push(
                `Row ${i + 2}: public deals sync — ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            }
          }
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
      const projectInstallerByHes = new Map<string, string | null>();

      for (const codeChunk of chunk(hesCodes, PROJECT_LOOKUP_CHUNK)) {
        const { data: projects, error: lookupErr } = await db
          .from("projects")
          .select("id, project_id, installer")
          .in("project_id", codeChunk);

        if (lookupErr) {
          throw new Error(`Project lookup failed: ${lookupErr.message}`);
        }

        for (const project of projects ?? []) {
          if (project.project_id && project.id) {
            projectIdByHes.set(project.project_id, project.id);
            projectInstallerByHes.set(
              project.project_id,
              project.installer != null ? String(project.installer) : null,
            );
          }
        }
      }

      const importedAt = new Date().toISOString();
      const projectSyncUpdates: ProjectPersonalInfoSync[] = [];
      const linkedProjectIds = [
        ...new Set(
          pendingRows
            .map((r) => projectIdByHes.get(r.mapped.hes_code))
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const latestRemitIdByProject = new Map<string, string | number>();
      for (const idChunk of chunk(linkedProjectIds, PROJECT_LOOKUP_CHUNK)) {
        const { data: latestRows, error: latestErr } = await db.rpc(
          "latest_remittance_for_projects",
          { project_ids: idChunk },
        );
        if (latestErr) {
          throw new Error(`Remittance lookup failed: ${latestErr.message}`);
        }
        for (const row of (latestRows ?? []) as { id?: string | number; project_id?: string }[]) {
          if (row.project_id && row.id != null) {
            latestRemitIdByProject.set(row.project_id, row.id);
          }
        }
      }

      for (const { csvRowNumber, mapped } of pendingRows) {
        const projectId = projectIdByHes.get(mapped.hes_code) ?? null;
        const projectInstaller = projectInstallerByHes.get(mapped.hes_code) ?? null;
        const rawRow = mapped.raw_row as Record<string, string>;
        if (projectId) {
          matched++;
          affectedProjectIds.add(projectId);
          projectSyncUpdates.push(
            buildProjectPersonalInfoSync(projectId, rawRow, mapped),
          );
        }

        const patch = remittanceUpsertPayload({
          ...mapped,
          project_id: projectId,
          file_name: fileName,
          file_hash: fileHash,
          imported_at: importedAt,
        });

        const latestRemitId = projectId
          ? latestRemitIdByProject.get(projectId)
          : undefined;

        if (latestRemitId != null) {
          const { error } = await db
            .from("remittance")
            .update(patch)
            .eq("id", latestRemitId);
          if (error) {
            errorMessages.push(`Row ${csvRowNumber}: ${error.message}`);
            continue;
          }
          updated++;
          if (projectId) {
            try {
              await syncPublicDealFromHub({
                installer: projectInstaller,
                project: { project_id: mapped.hes_code },
                remittance: remittanceEndpointPatch(patch),
                source: {
                  fileName,
                  rowNumber: csvRowNumber,
                  rawRow,
                },
              });
            } catch (err) {
              errorMessages.push(
                `Row ${csvRowNumber}: public deals sync — ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            }
          }
          continue;
        }

        const { error } = await db.from("remittance").insert({
          ...patch,
          row_number: csvRowNumber,
        });
        if (error) {
          errorMessages.push(`Row ${csvRowNumber}: ${error.message}`);
          continue;
        }
        inserted++;
        if (projectId) {
          try {
            await syncPublicDealFromHub({
              installer: projectInstaller,
              project: { project_id: mapped.hes_code },
              remittance: remittanceEndpointPatch(patch),
              source: {
                fileName,
                rowNumber: csvRowNumber,
                rawRow,
              },
            });
          } catch (err) {
            errorMessages.push(
              `Row ${csvRowNumber}: public deals sync — ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      }

      if (affectedProjectIds.size > 0) {
        await syncProjectPersonalInfoFromImport(db, projectSyncUpdates);
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
