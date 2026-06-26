import { customerDisplayName } from "@/lib/data-hub/normalize";
import type { Project, RemittanceSummary } from "@/lib/data-hub/queries";

type RemitLike = (RemittanceSummary & { imported_at?: string | null }) | null | undefined;

/** Resolved values for project columns (overlapping fields: newest source wins). */
export type ResolvedProjectDisplay = {
  customer: string | null;
  stage: string | null;
  contractDate: string | null;
  systemSizeKw: number | null;
  totalCost: number | null;
  salesRep: string | null;
  installer: string | null;
};

function numOrNull(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
}

function parseTs(iso: string | null | undefined): number {
  if (!iso?.trim()) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** When both sources have a value, the one updated most recently wins. */
export function pickLatestUpdatedString(
  projectValue: string | null | undefined,
  projectUpdatedAt: string | null | undefined,
  remitValue: string | null | undefined,
  remitUpdatedAt: string | null | undefined,
): string | null {
  const p = projectValue?.trim() || null;
  const r = remitValue?.trim() || null;
  if (p && r) {
    return parseTs(remitUpdatedAt) > parseTs(projectUpdatedAt) ? r : p;
  }
  return p ?? r ?? null;
}

export function pickLatestUpdatedNumber(
  projectValue: number | null | undefined,
  projectUpdatedAt: string | null | undefined,
  remitValue: number | null | undefined,
  remitUpdatedAt: string | null | undefined,
): number | null {
  const p = numOrNull(projectValue);
  const r = numOrNull(remitValue);
  if (p != null && r != null) {
    return parseTs(remitUpdatedAt) > parseTs(projectUpdatedAt) ? r : p;
  }
  return p ?? r ?? null;
}

export function resolveProjectCustomer(
  opportunityName: string | null | undefined,
  projectUpdatedAt: string | null | undefined,
  remitCustomerName: string | null | undefined,
  remitUpdatedAt: string | null | undefined,
): string | null {
  return pickLatestUpdatedString(
    customerDisplayName(opportunityName),
    projectUpdatedAt,
    remitCustomerName,
    remitUpdatedAt,
  );
}

export function resolveProjectStage(
  projectStage: string | null | undefined,
  projectUpdatedAt: string | null | undefined,
  remitStatus: string | null | undefined,
  remitUpdatedAt: string | null | undefined,
): string | null {
  return pickLatestUpdatedString(
    projectStage,
    projectUpdatedAt,
    remitStatus,
    remitUpdatedAt,
  );
}

export function resolveProjectDisplay(
  project: Pick<
    Project,
    | "opportunity_name"
    | "project_stage"
    | "contract_signed_date"
    | "system_size_kw"
    | "total_system_cost"
    | "sales_advisor_name"
    | "closer_name"
    | "setter_name"
    | "installer"
    | "updated_at"
  >,
  remittance: RemitLike,
): ResolvedProjectDisplay {
  const projectUpdatedAt = project.updated_at;
  const remitUpdatedAt = remittance?.imported_at ?? null;

  const salesAdvisor = pickLatestUpdatedString(
    project.sales_advisor_name,
    projectUpdatedAt,
    remittance?.sales_advisor,
    remitUpdatedAt,
  );

  return {
    customer: resolveProjectCustomer(
      project.opportunity_name,
      projectUpdatedAt,
      remittance?.customer_name,
      remitUpdatedAt,
    ),
    stage: resolveProjectStage(
      project.project_stage,
      projectUpdatedAt,
      remittance?.status,
      remitUpdatedAt,
    ),
    contractDate: pickLatestUpdatedString(
      project.contract_signed_date,
      projectUpdatedAt,
      remittance?.contract_date,
      remitUpdatedAt,
    ),
    systemSizeKw: pickLatestUpdatedNumber(
      project.system_size_kw,
      projectUpdatedAt,
      remittance?.pv_size,
      remitUpdatedAt,
    ),
    totalCost: pickLatestUpdatedNumber(
      project.total_system_cost,
      projectUpdatedAt,
      remittance?.contract_amount,
      remitUpdatedAt,
    ),
    salesRep:
      project.closer_name?.trim() ||
      salesAdvisor ||
      project.setter_name?.trim() ||
      null,
    installer: project.installer?.trim() || null,
  };
}
