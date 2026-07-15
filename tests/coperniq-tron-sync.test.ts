import assert from "node:assert/strict";
import test from "node:test";
import { mapCoperniqProjectToTron } from "@/lib/coperniq/tron-sync";

test("mapCoperniqProjectToTron maps project and finance fields without losing the source date", () => {
  const mapped = mapCoperniqProjectToTron({
    id: 867592,
    title: "Justin Sumner",
    status: "CANCELLED",
    workflowName: "Resi - EPC",
    phase: { name: "Initiation" },
    value: 62150.88,
    size: 12.6,
    street: "1010 East North Street",
    city: "Monticello",
    state: "IL",
    zipcode: "61856",
    primaryEmail: "justin@example.com",
    primaryPhone: "+12177142810",
    salesRep: { firstName: "Clint", lastName: "Feinauer" },
    owner: { id: 42, firstName: "Sally", lastName: "Setter" },
    jurisdiction: { name: "Monticello township" },
    createdAt: "2026-05-13T18:50:45.995-05:00",
    address: ["1010 E North St, Monticello, IL, 61856"],
    custom: {
      contract_signed_date: "2026-05-13T18:50:00-05:00",
      ownership_type: ["Lease"],
      financing_provider: ["Sunrun"],
      utility_company: ["Ameren"],
      ahj: ["Monticello township"],
      system_size_stc_dc_kw: 12.6,
      gross_contract_price: 62150.88,
      gross_ppw: 4.93260992,
      net_ppw: 0.17313643,
      sales_closer_name: "Clint Feinauer",
      dealer_company: ["Nox Power"],
      deal_type: ["Dealer"],
    },
  }, new Map([["42", { id: 42, email: "sally@example.com" }]]));

  assert.deepEqual(mapped.project, {
    project_id: "867592",
    opportunity_name: "Justin Sumner",
    address_line1: "1010 E North St, Monticello, IL, 61856",
    city: "Monticello",
    state_code: "IL",
    postal_code: "61856",
    email: "justin@example.com",
    phone: "+12177142810",
    project_stage: "Initiation",
    contract_signed_date: "2026-05-13",
    total_system_cost: 62150.88,
    system_size_kw: 12.6,
    sales_advisor_name: "Clint Feinauer",
    setter_name: "Sally Setter",
    setter_email: "sally@example.com",
    utility_provider: "Ameren",
  });
  assert.deepEqual(mapped.remittance, {
    sales_partner: "Nox Power",
    sales_advisor: "Clint Feinauer",
    channel: "Dealer",
    finance_type: "Lease",
    financier: "Sunrun",
    utility_provider: "Ameren",
    pv_size: 12.6,
    contract_amount: 62150.88,
    gross_ppw: 4.93260992,
    ppw: 0.17313643,
    contract_date: "2026-05-13",
  });
  assert.equal(mapped.rawRow.ahj, "Monticello township");
  assert.equal(mapped.rawRow.site_address, "1010 E North St, Monticello, IL, 61856");
  assert.equal(mapped.rawRow.setter_name, "Sally Setter");
  assert.equal(mapped.rawRow.setter_email, "sally@example.com");
  assert.equal(mapped.rawRow.source_created_at, "2026-05-13T18:50:45.995-05:00");
});
