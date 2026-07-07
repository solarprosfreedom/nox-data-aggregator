import assert from "node:assert/strict";
import test from "node:test";
import { mapPublicDealRow } from "@/lib/data-hub/queries";
import type { PublicDealRow } from "@/lib/public-deals/client";

function row(overrides: Partial<PublicDealRow> = {}): PublicDealRow {
  return {
    vendor: "axia",
    installer: "Axia Solar Corp",
    pk: "hes_id",
    pk_value: "HES-1",
    project: {
      project_id: "HES-1",
      opportunity_name: "Ada Lovelace",
      total_system_cost: "51737.60",
      system_size_kw: "6.88",
      updated_at: "2026-07-03T15:41:05.48328+00:00",
    },
    remittance: null,
    ...overrides,
  };
}

test("mapPublicDealRow normalizes project fields from endpoint rows", () => {
  const mapped = mapPublicDealRow(row());
  assert.equal(mapped.id, "HES-1");
  assert.equal(mapped.project_id, "HES-1");
  assert.equal(mapped.installer, "Axia Solar Corp");
  assert.equal(mapped.opportunity_name, "Ada Lovelace");
  assert.equal(mapped.total_system_cost, 51737.6);
  assert.equal(mapped.system_size_kw, 6.88);
  assert.equal(mapped.updated_at, "2026-07-03T15:41:05.48328+00:00");
});

test("mapPublicDealRow falls back to vendor status fields for project stage", () => {
  const mapped = mapPublicDealRow(
    row({
      vendor: "empwr",
      installer: "Empwr",
      pk: "project_id",
      pk_value: "3037293",
      project: {
        project_id: "3037293",
        opportunity_name: "Jon Cash",
        project_stage: null,
      },
      raw: {
        contract_status: "Sent",
      },
    }),
  );

  assert.equal(mapped.project_stage, "Sent");
});

test("mapPublicDealRow treats cancel_date as cancelled when stage is missing", () => {
  const mapped = mapPublicDealRow(
    row({
      vendor: "owe",
      installer: "OWE",
      pk: "pid",
      pk_value: "OUR106568",
      project: {
        project_id: "OUR106568",
        opportunity_name: "David Deleon",
        project_stage: null,
      },
      raw: {
        cancel_date: "2026-07-02",
      },
    }),
  );

  assert.equal(mapped.project_stage, "cancelled");
});

test("mapPublicDealRow falls back to Illum close_date for contract signed date", () => {
  const mapped = mapPublicDealRow(
    row({
      vendor: "illum",
      installer: "Illum",
      pk: "deal_id",
      pk_value: "332696023757",
      project: {
        project_id: "332696023757",
        opportunity_name: "Kimberly Wells",
        contract_signed_date: null,
      },
      raw: {
        close_date: "2026-07-06",
        raw_properties: {
          closedate: "2026-07-06T16:10:13.077Z",
        },
      },
    }),
  );

  assert.equal(mapped.contract_signed_date, "2026-07-06");
});

test("mapPublicDealRow returns null remittance when endpoint has no remittance values", () => {
  assert.equal(mapPublicDealRow(row({ remittance: null })).remittance, null);
  assert.equal(
    mapPublicDealRow(
      row({
        remittance: {
          id: "existing-row",
          imported_at: "2026-07-01T00:00:00.000Z",
          c0: null,
          payment_status: "",
        },
      }),
    ).remittance,
    null,
  );
});

test("mapPublicDealRow preserves meaningful remittance fields and parses numbers", () => {
  const mapped = mapPublicDealRow(
    row({
      remittance: {
        payment_date: "2026-07-05",
        payment_status: "Paid",
        c0: "1000.50",
        c1_paid: 500,
        gross_ppw: "3.8",
      },
    }),
  );

  assert.ok(mapped.remittance);
  assert.equal(mapped.remittance.payment_date, "2026-07-05");
  assert.equal(mapped.remittance.payment_status, "Paid");
  assert.equal(mapped.remittance.c0, 1000.5);
  assert.equal(mapped.remittance.c1_paid, 500);
  assert.equal(mapped.remittance.gross_ppw, 3.8);
});
