import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQcellsUpdate,
  duplicateReasonsForQcells,
  mapQcellsOpportunity,
  type QcellsOpportunity,
} from "@/lib/qcells/closed-won-sync";
import type { PublicDealRow } from "@/lib/public-deals/client";

const source: QcellsOpportunity = {
  Id: "006-test",
  HES_ID__c: "HES-42",
  Name: "Ada Lovelace",
  First_Name__c: "Ada",
  Last_Name__c: "Lovelace",
  Email_Address__c: "ada@example.com",
  Primary_Phone_Number__c: "(555) 010-0042",
  Street_Address__c: "42 Analytical Engine Way",
  City__c: "London",
  State__c: "CA",
  Zip_Code__c: "90210",
  StageName: "Closed Won",
  Contract_Signed_Date__c: "2026-07-15T10:00:00.000Z",
  Total_System_Cost__c: "21500.25",
  Utility_Company__c: "Grid Co",
  Finance_Type__c: "Loan",
  Financier__c: "Example Finance",
  Cash_Price__c: "20500",
  Total_Adders_Cost__c: "500",
  Total_Battery_Cost__c: "3500",
  List_of_Adders__c: "Main panel",
  Lead_Channel__c: "Referral",
  Sales_Org__c: "Example Sales",
};

const existing: PublicDealRow = {
  vendor: "axia",
  installer: "Axia",
  pk: "project_id",
  pk_value: "HES-42",
  project: {
    project_id: "HES-42",
    opportunity_name: "Ada Lovelace",
    setter_name: "Keep this setter",
    contract_signed_date: "2026-01-01",
  },
  remittance: { c0: 999, finance_type: "Cash" },
};

test("maps only confirmed Qcells fields into Axia project and remittance payloads", () => {
  const mapped = mapQcellsOpportunity(source);

  assert.equal(mapped.project.project_id, "HES-42");
  assert.equal(mapped.project.address_line1, "42 Analytical Engine Way");
  assert.equal(mapped.project.state_code, "CA");
  assert.equal(mapped.project.contract_signed_date, "2026-07-15");
  assert.equal(mapped.project.total_system_cost, 21500.25);
  assert.equal(mapped.remittance.cash_deal_value, 20500);
  assert.equal(mapped.remittance.contract_amount, 21500.25);
  assert.equal(mapped.remittance.contract_date, "2026-07-15");
  assert.equal("sales_advisor_name" in mapped.project, false);
  assert.equal("ppw" in mapped.remittance, false);
});

test("treats a matching phone as a duplicate even when the name differs", () => {
  const differentNameSamePhone = {
    ...existing,
    project: {
      ...existing.project,
      opportunity_name: "Ada Byron",
      phone: "5550100042",
      email: "different@example.com",
    },
  };

  assert.deepEqual(duplicateReasonsForQcells(source, [differentNameSamePhone]), ["phone"]);
});

test("merges an update without nulling or removing existing Axia-only values", () => {
  const update = buildQcellsUpdate(existing, mapQcellsOpportunity(source));

  assert.ok(update);
  assert.equal(update.project.setter_name, "Keep this setter");
  assert.equal(update.remittance.c0, 999);
  assert.equal(update.project.contract_signed_date, "2026-07-15");
  assert.equal(update.remittance.finance_type, "Loan");
});
