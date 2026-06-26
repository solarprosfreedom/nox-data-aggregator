import type { SupabaseClient } from "@supabase/supabase-js";
import { pickField } from "@/lib/csv/parse";
import { customerDisplayName } from "@/lib/data-hub/normalize";
import { omitEmptyPatchFields } from "@/lib/data-hub/remittance-upsert";

/** Personal / contact fields on `projects` (SSOT for the UI). */
export type ProjectPersonalInfoSync = {
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
};

const PROJECT_PERSONAL_KEYS = [
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
] as const;

/** Extract personal-info updates from any import row (remittance or projects CSV). */
export function mapProjectPersonalInfoFromRow(
  row: Record<string, string>,
): Omit<ProjectPersonalInfoSync, "projectId"> {
  const firstName = pickField(row, "First Name");
  const lastName = pickField(row, "Last Name");
  const customerName = pickField(row, "Customer Name");
  const opportunityName = pickField(row, "Opportunity Name");
  const composedName =
    opportunityName ||
    customerName ||
    [firstName, lastName].filter(Boolean).join(" ");

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
  }) as Omit<ProjectPersonalInfoSync, "projectId">;
}

/** Merge field-mapper project + remittance patches onto project personal fields. */
export function projectPersonalInfoFromImportPatches(
  projectPatch: Record<string, unknown>,
  remittancePatch: Record<string, unknown>,
): Omit<ProjectPersonalInfoSync, "projectId"> {
  const customerFromRemit = remittancePatch.customer_name as string | undefined;
  const opportunityFromProject = projectPatch.opportunity_name as string | undefined;

  return omitEmptyPatchFields({
    opportunity_name:
      opportunityFromProject?.trim() ||
      customerFromRemit?.trim() ||
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
  }) as Omit<ProjectPersonalInfoSync, "projectId">;
}

/**
 * Push non-empty personal-info fields onto linked projects.
 * Projects table is SSOT — remittance/import only patches fields present in the file.
 */
export async function syncProjectPersonalInfoFromImport(
  db: SupabaseClient,
  updates: ProjectPersonalInfoSync[],
): Promise<number> {
  const byProject = new Map<string, Record<string, string>>();

  for (const update of updates) {
    const { projectId, ...fields } = update;
    if (!projectId) continue;

    const entry = byProject.get(projectId) ?? {};
    for (const key of PROJECT_PERSONAL_KEYS) {
      const value = fields[key];
      if (typeof value === "string" && value.trim()) {
        entry[key] = value.trim();
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
