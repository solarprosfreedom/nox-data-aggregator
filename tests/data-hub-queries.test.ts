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
