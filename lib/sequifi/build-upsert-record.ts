import type { RemittanceSummary } from "@/lib/data-hub/queries";
import type { SequifiUpsertRecord } from "@/lib/sequifi/client";
import { resolveStateCode } from "@/lib/data-hub/normalize";
import { resolveSequifiJobFields } from "@/lib/sequifi/job-status";
import { sequifiLocationCode } from "@/lib/sequifi/location-code";

export type ProjectForSequifiUpsert = {
  opportunity_name: string | null;
  state_code: string | null;
  address_line1: string | null;
  postal_code: string | null;
  system_size_kw: number | null;
  total_system_cost: number | null;
  contract_signed_date: string | null;
  installer: string | null;
  project_stage: string | null;
  cancel_date?: string | null;
  net_epc: number | null;
  setter_name: string | null;
  setter_email: string | null;
  closer_name: string | null;
  closer_email: string | null;
  sales_advisor_name: string | null;
  sales_advisor_email: string | null;
  setter_sequifi_employee_id: string | null;
  closer_sequifi_employee_id: string | null;
};

function fmtDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.length >= 10 ? v.slice(0, 10) : v;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function parseSequifiEmployeeId(value: string | null | undefined): number | null {
  const n = Number(value?.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function num(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function sumNums(...vals: (number | null | undefined)[]): number | null {
  let total = 0;
  let any = false;
  for (const v of vals) {
    const n = num(v);
    if (n != null) {
      total += n;
      any = true;
    }
  }
  return any ? total : null;
}

function closerName(project: ProjectForSequifiUpsert): string | null {
  return (
    project.closer_name?.trim() ||
    project.sales_advisor_name?.trim() ||
    null
  );
}

function closerEmail(project: ProjectForSequifiUpsert): string | null {
  return (
    project.closer_email?.trim() ||
    project.sales_advisor_email?.trim() ||
    null
  );
}

/** Builds a Solar-valid upsert record, or null if required fields are missing. */
export function buildSequifiUpsertRecord(
  project: ProjectForSequifiUpsert,
  pid: string,
  isNew: boolean,
  remit: RemittanceSummary | null,
): SequifiUpsertRecord | null {
  return buildSequifiRecord(project, pid, isNew, remit, true);
}

/**
 * Builds a partial update for an existing Sequifi PID. Existing sales merge
 * only the fields included in the request, so missing new-sale fields must not
 * prevent available data from being updated.
 */
export function buildSequifiExistingUpdateRecord(
  project: ProjectForSequifiUpsert,
  pid: string,
  remit: RemittanceSummary | null,
): SequifiUpsertRecord | null {
  return buildSequifiRecord(project, pid, false, remit, false);
}

function buildSequifiRecord(
  project: ProjectForSequifiUpsert,
  pid: string,
  isNew: boolean,
  remit: RemittanceSummary | null,
  requireNewSaleFields: boolean,
): SequifiUpsertRecord | null {
  const customer_name = project.opportunity_name?.trim();
  const kw = project.system_size_kw;
  const customer_signoff = fmtDate(project.contract_signed_date);
  const customer_state = resolveStateCode(project);
  if (
    requireNewSaleFields &&
    (!customer_name || kw == null || !customer_signoff || !customer_state)
  ) {
    return null;
  }

  const rec: SequifiUpsertRecord = { pid };
  if (customer_name) rec.customer_name = customer_name;
  if (kw != null) rec.kw = kw;
  if (customer_signoff) rec.customer_signoff = customer_signoff;
  if (customer_state) {
    rec.customer_state = customer_state;
    // For an existing PID, omit the location rather than replacing an existing
    // correct value with an inferred ".Unknown" location.
    if (requireNewSaleFields || project.installer?.trim()) {
      rec.location_code = sequifiLocationCode(customer_state, project.installer);
    }
  }

  if (project.total_system_cost != null) {
    rec.gross_account_value = project.total_system_cost;
  }
  if (project.installer?.trim()) rec.install_partner = project.installer.trim();

  const { jobStatus, dateCancelled } = resolveSequifiJobFields(
    project.project_stage,
    remit?.status,
    isNew,
    project.cancel_date,
  );
  if (jobStatus) rec.job_status = jobStatus;
  if (dateCancelled) rec.date_cancelled = dateCancelled;

  const setterName = project.setter_name?.trim();
  if (setterName) rec.setter1_name = setterName;
  const setterEmail = project.setter_email?.trim();
  if (setterEmail) rec.setter1_email = setterEmail;
  const setter1Id = parseSequifiEmployeeId(project.setter_sequifi_employee_id);
  if (setter1Id != null) rec.setter1_id = setter1Id;

  const closer = closerName(project);
  if (closer) rec.closer1_name = closer;
  const closerMail = closerEmail(project);
  if (closerMail) rec.closer1_email = closerMail;
  const closer1Id = parseSequifiEmployeeId(project.closer_sequifi_employee_id);
  if (closer1Id != null) rec.closer1_id = closer1Id;

  if (remit) {
    if (remit.gross_ppw != null) rec.gross_epc = round2(num(remit.gross_ppw)!);
    const netFromRemit = num(remit.ppw);
    if (netFromRemit != null) rec.net_epc = round2(netFromRemit);
    else if (project.net_epc != null) rec.net_epc = round2(num(project.net_epc)!);

    if (remit.adder_amount != null) rec.adders = remit.adder_amount;
    if (remit.finance_fee != null) rec.dealer_fee_amount = remit.finance_fee;
    if (remit.finance_type?.trim()) rec.finance_type = remit.finance_type.trim();
    if (remit.financier?.trim()) rec.financier = remit.financier.trim();
    if (remit.payment_status?.trim()) {
      rec.payment_status = remit.payment_status.trim();
    }

    const totalCommission = sumNums(remit.c0, remit.c1, remit.c2);
    if (totalCommission != null) rec.total_commission = totalCommission;

    const totalPaid = sumNums(remit.c0_paid, remit.c1_paid, remit.c2_paid);
    if (totalPaid != null) rec.total_paid_to_date = totalPaid;
  } else if (project.net_epc != null) {
    rec.net_epc = round2(num(project.net_epc)!);
  }

  return Object.keys(rec).length > 1 ? rec : null;
}
