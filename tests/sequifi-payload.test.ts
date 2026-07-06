import assert from "node:assert/strict";
import test from "node:test";
import { buildSequifiUpsertRecord } from "@/lib/sequifi/build-upsert-record";
import type { RemittanceSummary } from "@/lib/data-hub/queries";

const project = {
  opportunity_name: "Ronald Bolding - 855 Cypress Dr",
  state_code: "CA",
  address_line1: "855 Cypress Dr",
  postal_code: "91784",
  system_size_kw: 6.88,
  total_system_cost: 51737.6,
  contract_signed_date: "2026-06-13",
  installer: "Axia Solar Corp",
  project_stage: "Installation",
  cancel_date: null,
  net_epc: 3.1,
  setter_name: "Jonas Lim",
  setter_email: "setter@example.com",
  closer_name: "Adrian Trevino",
  closer_email: "closer@example.com",
  sales_advisor_name: "Fallback Advisor",
  sales_advisor_email: "advisor@example.com",
  setter_sequifi_employee_id: "12345",
  closer_sequifi_employee_id: "67890",
};

const remittance = {
  payment_date: "2026-07-05",
  payment_status: "Paid",
  status: "Install",
  gross_ppw: 3.8,
  ppw: 3.2,
  adder_amount: 1000,
  finance_fee: 2500,
  finance_type: "Loan",
  financier: "GoodLeap",
  c0: 1000,
  c1: 2000,
  c2: 3000,
  adjusted_c2: 2800,
  c0_paid: 1000,
  c1_paid: 2000,
  c2_paid: 2800,
} as RemittanceSummary;

test("buildSequifiUpsertRecord sends the current supported Sequifi payload", () => {
  const record = buildSequifiUpsertRecord(project, "HES-1110697", true, remittance);
  assert.ok(record);

  assert.deepEqual(record, {
    pid: "HES-1110697",
    customer_name: "Ronald Bolding - 855 Cypress Dr",
    kw: 6.88,
    customer_signoff: "2026-06-13",
    customer_state: "CA",
    location_code: "CA.Axia",
    gross_account_value: 51737.6,
    install_partner: "Axia Solar Corp",
    job_status: "Install",
    setter1_name: "Jonas Lim",
    setter1_email: "setter@example.com",
    setter1_id: 12345,
    closer1_name: "Adrian Trevino",
    closer1_email: "closer@example.com",
    closer1_id: 67890,
    gross_epc: 3.8,
    net_epc: 3.2,
    adders: 1000,
    dealer_fee_amount: 2500,
    finance_type: "Loan",
    financier: "GoodLeap",
    payment_status: "Paid",
    total_commission: 6000,
    total_paid_to_date: 5800,
  });
});

test("buildSequifiUpsertRecord does not emit remittance payment dates or milestone fields", () => {
  const record = buildSequifiUpsertRecord(project, "HES-1110697", true, remittance);
  assert.ok(record);

  for (const key of [
    "payment_date",
    "remittance_payment_date",
    "m1_amount",
    "m2_amount",
    "m3_amount",
    "adjusted_m3_amount",
    "m1_paid",
    "m2_paid",
    "m3_paid",
    "m1_payable_date",
    "m2_payable_date",
    "m3_payable_date",
  ]) {
    assert.equal(Object.hasOwn(record, key), false, `${key} should not be sent`);
  }
});

test("buildSequifiUpsertRecord sends date_cancelled only for canceled jobs", () => {
  const active = buildSequifiUpsertRecord(
    { ...project, project_stage: "Installation", cancel_date: "2026-07-01" },
    "HES-1",
    false,
    null,
  );
  assert.ok(active);
  assert.equal(Object.hasOwn(active, "date_cancelled"), false);

  const canceled = buildSequifiUpsertRecord(
    { ...project, project_stage: "Canceled", cancel_date: "2026-07-01" },
    "HES-2",
    false,
    null,
  );
  assert.ok(canceled);
  assert.equal(canceled.date_cancelled, "2026-07-01");
});
