"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/profile";
import { parseCsv, rowsToRecords } from "@/lib/csv/parse";
import {
  applyMapping,
  hasRemittancePatch,
  splitMappedPatch,
  type SchemaType,
} from "@/lib/data-hub/field-mapper";
import type { MappingTemplate } from "@/lib/data-hub/mapping-templates";
import {
  projectPersonalInfoFromImportPatches,
} from "@/lib/data-hub/project-personal-sync";
import { syncPublicDealFromHub } from "@/lib/data-hub/public-deals-sync";
import {
  listAllPublicDeals,
  invalidatePublicDealsCache,
  publicDealProjectId,
  type PublicDealRow,
} from "@/lib/public-deals/client";

export type UploadSampleResult =
  | { ok: true; id: string; rowCount: number; columnCount: number }
  | { error: string };

export async function uploadSampleCsv(formData: FormData): Promise<UploadSampleResult> {
  void formData;
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };
  return { error: "Sample CSV storage is disabled. Use the Field Mapper upload flow directly." };
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

  let inserted = 0;
  let updated = 0;
  let remittanceInserted = 0;
  let remittanceUpdated = 0;
  const errorMessages: string[] = [];
  const endpointByProjectId = new Map<string, PublicDealRow>();
  for (const row of await listAllPublicDeals()) {
    endpointByProjectId.set(publicDealProjectId(row), row);
  }

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

    const existing = endpointByProjectId.get(normalizedProjectId) ?? null;
    const projectPayload = {
      project_id: normalizedProjectId,
      ...projectPersonalInfoFromImportPatches(projectPatch, remittancePatch),
      ...projectPatch,
      updated_at: new Date().toISOString(),
    };
    const installerForRow =
      installer ??
      (typeof projectPayload.installer === "string" ? projectPayload.installer : null) ??
      existing?.installer ??
      null;
    if (!installerForRow) {
      errorMessages.push(`Row ${i + 2}: installer is required for endpoint import`);
      continue;
    }

    try {
      await syncPublicDealFromHub({
        installer: installerForRow,
        project: projectPayload,
        remittance: remittancePatch,
        source: {
          fileName: String(fileName ?? "manual"),
          rowNumber: i + 2,
          rawRow: rows[i],
        },
      });
      if (existing) updated++;
      else {
        inserted++;
        endpointByProjectId.set(normalizedProjectId, {
          vendor: "axia",
          installer: installerForRow,
          pk: "project_id",
          pk_value: normalizedProjectId,
          project: projectPayload,
          remittance: hasRemittancePatch(remittancePatch) ? remittancePatch : null,
        } as PublicDealRow);
      }
      if (hasRemittancePatch(remittancePatch)) {
        if (existing?.remittance) remittanceUpdated++;
        else remittanceInserted++;
      }
    } catch (err) {
      errorMessages.push(
        `Row ${i + 2}: public deals sync — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  invalidatePublicDealsCache();
  revalidatePath("/dashboard");
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
  void id;
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };
  return { error: "Sample CSV storage is disabled." };
}

export async function saveMappingTemplate(formData: FormData): Promise<
  { ok: true; id: string } | { error: string }
> {
  void formData;
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };
  return { error: "Mapping templates are saved in this browser now." };
}

export async function deleteMappingTemplate(
  id: string
): Promise<{ ok: true } | { error: string }> {
  void id;
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };
  return { error: "Mapping templates are saved in this browser now." };
}

export async function fetchMappingTemplates(
  schemaType?: "projects" | "remittance",
  installerName?: string
): Promise<MappingTemplate[] | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };
  void schemaType;
  void installerName;
  return [];
}

export async function fetchInstallerNames(): Promise<string[] | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." };

  try {
    const { mergeInstallerOptions } = await import("@/lib/data-hub/installers");
    const fromDb = (await listAllPublicDeals())
      .map((r) => (r.installer != null ? String(r.installer) : ""))
      .filter(Boolean);
    return mergeInstallerOptions(fromDb);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Load failed.",
    };
  }
}
