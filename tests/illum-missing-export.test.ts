import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIllumMissingExportRows,
  illumMissingRowsToCsv,
} from "@/lib/data-hub/illum-missing-export";
import type { PublicDealRow } from "@/lib/public-deals/client";

function deal(
  project: Record<string, unknown>,
  remittance: Record<string, unknown> | null,
): PublicDealRow {
  return {
    vendor: "illum",
    installer: "Illum",
    pk: "deal_id",
    pk_value: String(project.project_id ?? "missing"),
    project,
    remittance,
  };
}

test("buildIllumMissingExportRows identifies incomplete Illum fields", () => {
  const rows = buildIllumMissingExportRows([
    deal(
      {
        project_id: "hubspot_2",
        opportunity_name: "Missing Size",
        system_size_kw: 0,
      },
      {
        pv_size: 6.4,
        gross_ppw: 3.2,
        ppw: 2.7,
        contract_adder_detail: "Roof work",
        adder_amount: 1200,
      },
    ),
    deal(
      {
        project_id: "hubspot_1",
        opportunity_name: "Complete Deal",
        system_size_kw: 8.1,
        install_date: "2026-07-20",
        battery_size_kw: 13.5,
      },
      {
        pv_size: 8.1,
        gross_ppw: 3.4,
        ppw: 2.9,
        battery_price: 9000,
        adder_details: "Panel upgrade",
        adder_amount: 2500,
      },
    ),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.project_id, "hubspot_2");
  assert.equal(rows[0]?.hubspot_deal_id, "2");
  assert.equal(rows[0]?.adder_details, "Roof work");
  assert.deepEqual(rows[0]?.missing_fields.split("; "), [
    "system_size_kw",
    "install_date",
    "battery_size_kw",
    "battery_price",
  ]);
});

test("illumMissingRowsToCsv exports stable columns and spreadsheet-safe text", () => {
  const rows = buildIllumMissingExportRows([
    deal(
      {
        project_id: "hubspot_9",
        opportunity_name: "=Formula Customer",
      },
      null,
    ),
  ]);
  const csv = illumMissingRowsToCsv(rows);

  assert.match(csv, /^\uFEFFproject_id,hubspot_deal_id,opportunity_name/);
  assert.match(csv, /'=Formula Customer/);
  assert.match(csv, /system_size_kw; pv_size; install_date/);
});
