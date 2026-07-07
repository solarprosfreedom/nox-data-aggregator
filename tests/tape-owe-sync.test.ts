import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTapeOwePublicDealSyncInput,
  mapTapeRecordToProject,
  type TapeRecord,
} from "@/lib/tape/owe-sync";

function field(externalId: string, value: Record<string, unknown>) {
  return {
    external_id: externalId,
    values: [value],
  };
}

test("mapTapeRecordToProject uses OWE pid and keeps Tape record identity", () => {
  const record: TapeRecord = {
    record_id: 175169590,
    fields: [
      field("customer_name", { value: "<p>Melissa McWilliams </p>" }),
      field("our_", { value: "OUR106732" }),
      field("ntp_app_status", { value: "Pending NTP" }),
      field("sale_date", { start_date: "2026-07-06" }),
      field("total_system_cost_calc__h", { decimal: 34219 }),
      field("contracted_system_size", { value: "8.1" }),
      field("email_address", { value: "melissa@example.com" }),
      field("phone_number", { value: "+1 480 293 4648" }),
      field("address", {
        street_address: "12432 West Madero Drive",
        city: "Arizona City",
        state: "Arizona",
        postal_code: "85123",
      }),
      field("state", { value: { title: "AZ :: Arizona" } }),
      field("primary_sales_rep", { value: { title: "Ryan Scott Fuller | DRIVIN" } }),
    ],
  };

  const mapped = mapTapeRecordToProject(record);

  assert.ok(mapped);
  assert.equal(mapped.project_id, "OUR106732");
  assert.equal(mapped.tape_record_id, 175169590);
  assert.equal(mapped.opportunity_name, "Melissa McWilliams");
  assert.equal(mapped.first_name, "Melissa");
  assert.equal(mapped.last_name, "McWilliams");
  assert.equal(mapped.project_stage, "Pending NTP");
  assert.equal(mapped.contract_signed_date, "2026-07-06");
  assert.equal(mapped.total_system_cost, 34219);
  assert.equal(mapped.system_size_kw, 8.1);
  assert.equal(mapped.email, "melissa@example.com");
  assert.equal(mapped.address_line1, "12432 West Madero Drive");
  assert.equal(mapped.city, "Arizona City");
  assert.equal(mapped.state_code, "AZ :: Arizona");
  assert.equal(mapped.postal_code, "85123");

  const syncInput = buildTapeOwePublicDealSyncInput(mapped);
  assert.equal(syncInput.installer, "OWE");
  assert.deepEqual(syncInput.vendorKey, { tape_record_id: "175169590" });
  assert.equal(syncInput.project.project_id, "OUR106732");
  assert.equal("tape_record_id" in syncInput.project, false);
});
