import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDate, parseNumeric, pickField } from "@/lib/csv/parse";
import { customerDisplayName } from "@/lib/data-hub/normalize";
import { omitEmptyPatchFields } from "@/lib/data-hub/remittance-upsert";

/** Fields on `projects` that remittance / CSV import may patch (SSOT = projects). */
export type ProjectImportSync = {
  projectId: string;
  opportunity_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  sales_advisor_name?: string;
  project_stage?: string;
  address_line1?: string;
  city?: string;
  state_code?: string;
  postal_code?: string;
  contract_signed_date?: string;
  system_size_kw?: number;
  total_system_cost?: number;
  installer?: string;
};

/** @deprecated Use ProjectImportSync */
export type ProjectPersonalInfoSync = ProjectImportSync;

const STRING_SYNC_KEYS = [
  "opportunity_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "sales_advisor_name",
  "project_stage",
  "address_line1",
  "city",
  "state_code",
  "postal_code",
  "contract_signed_date",
  "installer",
] as const;

const NUMBER_SYNC_KEYS = ["system_size_kw", "total_system_cost"] as const;

export type RemittanceMappedForProjectSync = {
  customer_name?: string | null;
  status?: string | null;
  sales_advisor?: string | null;
  sales_partner?: string | null;
  contract_date?: string | null;
  pv_size?: number | null;
  contract_amount?: number | null;
};

/** Extract project-field updates from any import row (remittance or projects CSV). */
export function mapProjectPersonalInfoFromRow(
  row: Record<string, string>,
): Omit<ProjectImportSync, "projectId"> {
  const firstName = pickField(row, "First Name");
  const lastName = pickField(row, "Last Name");
  const customerName = pickField(row, "Customer Name");
  const opportunityName = pickField(row, "Opportunity Name");
  const composedName =
    opportunityName ||
    customerName ||
    [firstName, lastName].filter(Boolean).join(" ");

  const contractDate = parseDate(
    pickField(row, "Original Contract Signed date", "Contract Date"),
  );
  const systemSize = parseNumeric(
    pickField(row, "System Size (kW)", "System Size", "① PV Size", "PV Size"),
  );
  const totalCost = parseNumeric(
    pickField(row, "Total System Cost", "Contract Amount"),
  );

  return omitEmptyPatchFields({
    opportunity_name: customerDisplayName(composedName) ?? undefined,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    email: pickField(row, "Email Address", "Email") || undefined,
    phone: pickField(row, "Primary Phone Number", "Phone") || undefined,
    sales_advisor_name:
      pickField(row, "Sales Advisor", "Sales Advisor: Full Name") || undefined,
    project_stage: pickField(row, "Status", "Project Stage", "Stage") || undefined,
    address_line1: pickField(row, "Street Address", "Address") || undefined,
    city: pickField(row, "City") || undefined,
    state_code: pickField(row, "State") || undefined,
    postal_code: pickField(row, "Zip Code", "Zip") || undefined,
    contract_signed_date: contractDate ?? undefined,
    system_size_kw: systemSize ?? undefined,
    total_system_cost: totalCost ?? undefined,
    installer:
      pickField(row, "Installer", "Dealer", "Dealer Name", "Sales Partner") ||
      undefined,
  }) as Omit<ProjectImportSync, "projectId">;
}

/** Merge CSV row + mapped remittance fields for project sync. */
export function buildProjectPersonalInfoSync(
  projectId: string,
  rawRow: Record<string, string>,
  mapped: RemittanceMappedForProjectSync,
): ProjectImportSync {
  const fromRow = mapProjectPersonalInfoFromRow(rawRow);
  return {
    projectId,
    ...fromRow,
    opportunity_name:
      fromRow.opportunity_name ||
      mapped.customer_name?.trim() ||
      undefined,
    project_stage:
      fromRow.project_stage || mapped.status?.trim() || undefined,
    sales_advisor_name:
      fromRow.sales_advisor_name ||
      mapped.sales_advisor?.trim() ||
      undefined,
    contract_signed_date:
      fromRow.contract_signed_date || mapped.contract_date || undefined,
    system_size_kw: fromRow.system_size_kw ?? mapped.pv_size ?? undefined,
    total_system_cost:
      fromRow.total_system_cost ?? mapped.contract_amount ?? undefined,
    installer:
      fromRow.installer || mapped.sales_partner?.trim() || undefined,
  };
}

/** Merge field-mapper project + remittance patches onto project fields. */
export function projectPersonalInfoFromImportPatches(
  projectPatch: Record<string, unknown>,
  remittancePatch: Record<string, unknown>,
): Omit<ProjectImportSync, "projectId"> {
  return omitEmptyPatchFields({
    opportunity_name:
      (projectPatch.opportunity_name as string | undefined)?.trim() ||
      (remittancePatch.customer_name as string | undefined)?.trim() ||
      undefined,
    first_name: (projectPatch.first_name as string | undefined) || undefined,
    last_name: (projectPatch.last_name as string | undefined) || undefined,
    email: (projectPatch.email as string | undefined) || undefined,
    phone: (projectPatch.phone as string | undefined) || undefined,
    sales_advisor_name:
      (projectPatch.sales_advisor_name as string | undefined) ||
      (remittancePatch.sales_advisor as string | undefined) ||
      undefined,
    project_stage:
      (projectPatch.project_stage as string | undefined) ||
      (remittancePatch.status as string | undefined) ||
      undefined,
    address_line1: (projectPatch.address_line1 as string | undefined) || undefined,
    city: (projectPatch.city as string | undefined) || undefined,
    state_code: (projectPatch.state_code as string | undefined) || undefined,
    postal_code: (projectPatch.postal_code as string | undefined) || undefined,
    contract_signed_date:
      (projectPatch.contract_signed_date as string | undefined) ||
      (remittancePatch.contract_date as string | undefined) ||
      undefined,
    system_size_kw:
      (projectPatch.system_size_kw as number | undefined) ??
      (remittancePatch.pv_size as number | undefined) ??
      undefined,
    total_system_cost:
      (projectPatch.total_system_cost as number | undefined) ??
      (remittancePatch.contract_amount as number | undefined) ??
      undefined,
    installer:
      (projectPatch.installer as string | undefined) ||
      (remittancePatch.sales_partner as string | undefined) ||
      undefined,
  }) as Omit<ProjectImportSync, "projectId">;
}

/**
 * Push non-empty fields onto linked projects.
 * Projects table is SSOT — import only patches columns present in the file.
 */
export async function syncProjectPersonalInfoFromImport(
  db: SupabaseClient,
  updates: ProjectImportSync[],
): Promise<number> {
  const byProject = new Map<string, Record<string, string | number>>();

  for (const update of updates) {
    const { projectId, ...fields } = update;
    if (!projectId) continue;

    const entry = byProject.get(projectId) ?? {};

    for (const key of STRING_SYNC_KEYS) {
      const value = fields[key];
      if (typeof value === "string" && value.trim()) {
        entry[key] = value.trim();
      }
    }

    for (const key of NUMBER_SYNC_KEYS) {
      const value = fields[key];
      if (value != null && Number.isFinite(Number(value))) {
        entry[key] = Number(value);
      }
    }

    byProject.set(projectId, entry);
  }

  if (byProject.size === 0) return 0;

  const now = new Date().toISOString();
  let updated = 0;

  for (const [projectId, fields] of byProject) {
    if (Object.keys(fields).length === 0) continue;

    const { error } = await db
      .from("projects")
      .update({ ...fields, updated_at: now })
      .eq("id", projectId);

    if (error) throw new Error(error.message);
    updated += 1;
  }

  return updated;
}
