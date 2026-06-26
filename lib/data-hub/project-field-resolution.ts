import { customerDisplayName } from "@/lib/data-hub/normalize";
import type { Project, RemittanceSummary } from "@/lib/data-hub/queries";

type RemitLike = RemittanceSummary | null | undefined;

/** Resolved values for project columns (projects SSOT, remittance fills gaps). */
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

export function resolveProjectCustomer(
  opportunityName: string | null | undefined,
  remitCustomerName: string | null | undefined,
): string | null {
  return (
    customerDisplayName(opportunityName) ??
    remitCustomerName?.trim() ??
    null
  );
}

export function resolveProjectStage(
  projectStage: string | null | undefined,
  remitStatus: string | null | undefined,
): string | null {
  return remitStatus?.trim() || projectStage?.trim() || null;
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
  >,
  remittance: RemitLike,
): ResolvedProjectDisplay {
  return {
    customer: resolveProjectCustomer(
      project.opportunity_name,
      remittance?.customer_name,
    ),
    stage: resolveProjectStage(project.project_stage, remittance?.status),
    contractDate:
      project.contract_signed_date?.trim() ||
      remittance?.contract_date?.trim() ||
      null,
    systemSizeKw:
      numOrNull(project.system_size_kw) ?? numOrNull(remittance?.pv_size),
    totalCost:
      numOrNull(project.total_system_cost) ??
      numOrNull(remittance?.contract_amount),
    salesRep:
      project.closer_name?.trim() ||
      project.sales_advisor_name?.trim() ||
      remittance?.sales_advisor?.trim() ||
      project.setter_name?.trim() ||
      null,
    installer:
      project.installer?.trim() ||
      remittance?.sales_partner?.trim() ||
      null,
  };
}
