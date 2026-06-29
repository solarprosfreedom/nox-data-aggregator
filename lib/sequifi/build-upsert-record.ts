import type { RemittanceSummary } from "@/lib/data-hub/queries";
import type { SequifiUpsertRecord } from "@/lib/sequifi/client";
import { resolveStateCode } from "@/lib/data-hub/normalize";
import { resolveSequifiJobStatus } from "@/lib/sequifi/job-status";
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

function milestonePayableDate(
  remit: RemittanceSummary | null,
  paid: number | null | undefined,
): string | null {
  const paidAmount = num(paid);
  if (paidAmount == null || paidAmount <= 0) return null;
  return fmtDate(remit?.payment_date);
}

/** Builds a Solar-valid upsert record, or null if required fields are missing. */
export function buildSequifiUpsertRecord(
  project: ProjectForSequifiUpsert,
  pid: string,
  isNew: boolean,
  remit: RemittanceSummary | null,
): SequifiUpsertRecord | null {
  const customer_name = project.opportunity_name?.trim();
  const kw = project.system_size_kw;
  const customer_signoff = fmtDate(project.contract_signed_date);
  const customer_state = resolveStateCode(project);
  if (!customer_name || kw == null || !customer_signoff || !customer_state) {
    return null;
  }

  const rec: SequifiUpsertRecord = {
    pid,
    customer_name,
    kw,
    customer_signoff,
    customer_state,
    location_code: sequifiLocationCode(customer_state, project.installer),
  };

  if (project.total_system_cost != null) {
    rec.gross_account_value = project.total_system_cost;
  }
  if (project.installer?.trim()) rec.install_partner = project.installer.trim();

  const jobStatus = resolveSequifiJobStatus(
    project.project_stage,
    remit?.status,
    isNew,
  );
  if (jobStatus) rec.job_status = jobStatus;

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

    const paymentDate = fmtDate(remit.payment_date);
    if (paymentDate) rec.remittance_payment_date = paymentDate;

    const m1 = num(remit.c0);
    const m2 = num(remit.c1);
    const m3 = num(remit.c2);
    if (m1 != null) rec.m1_amount = m1;
    if (m2 != null) rec.m2_amount = m2;
    if (m3 != null) rec.m3_amount = m3;

    const adjustedM3 = num(remit.adjusted_c2);
    if (adjustedM3 != null) rec.adjusted_m3_amount = adjustedM3;

    const m1Paid = num(remit.c0_paid);
    const m2Paid = num(remit.c1_paid);
    const m3Paid = num(remit.c2_paid);
    if (m1Paid != null) rec.m1_paid = m1Paid;
    if (m2Paid != null) rec.m2_paid = m2Paid;
    if (m3Paid != null) rec.m3_paid = m3Paid;

    const m1Payable = milestonePayableDate(remit, remit.c0_paid);
    if (m1Payable) rec.m1_payable_date = m1Payable;
    const m2Payable = milestonePayableDate(remit, remit.c1_paid);
    if (m2Payable) rec.m2_payable_date = m2Payable;
    const m3Payable = milestonePayableDate(remit, remit.c2_paid);
    if (m3Payable) rec.m3_payable_date = m3Payable;

    const totalCommission = sumNums(remit.c0, remit.c1, remit.c2);
    if (totalCommission != null) rec.total_commission = totalCommission;

    const totalPaid = sumNums(remit.c0_paid, remit.c1_paid, remit.c2_paid);
    if (totalPaid != null) rec.total_paid_to_date = totalPaid;
  } else if (project.net_epc != null) {
    rec.net_epc = round2(num(project.net_epc)!);
  }

  return rec;
}
