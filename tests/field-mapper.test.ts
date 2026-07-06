import assert from "node:assert/strict";
import test from "node:test";
import {
  autoSuggestMapping,
  isFieldMappingBlocked,
  normalizeTemplateColumnMap,
  splitMappedPatch,
} from "@/lib/data-hub/field-mapper";

test("normalizeTemplateColumnMap upgrades legacy hes_code to project_id", () => {
  assert.deepEqual(
    normalizeTemplateColumnMap({
      "HES Code": "hes_code",
      Email: "email",
    }),
    {
      "HES Code": "project_id",
      Email: "email",
    },
  );
});

test("splitMappedPatch separates project and remittance endpoint payloads", () => {
  assert.deepEqual(
    splitMappedPatch({
      project_id: "HES-1",
      opportunity_name: "Ada Lovelace",
      status: "Paid",
      c0: 1000,
      updated_at: "ignored",
      unknown_column: "ignored",
    }),
    {
      project: {
        project_id: "HES-1",
        opportunity_name: "Ada Lovelace",
      },
      remittance: {
        status: "Paid",
        c0: 1000,
      },
    },
  );
});

test("isFieldMappingBlocked prevents duplicate and mutually exclusive mappings", () => {
  assert.equal(isFieldMappingBlocked("email", new Set(["email"]), ""), true);
  assert.equal(isFieldMappingBlocked("email", new Set(["email"]), "email"), false);
  assert.equal(isFieldMappingBlocked("system_size_watts", new Set(["system_size_kw"]), ""), true);
});

test("autoSuggestMapping maps common project and remittance headers", () => {
  const mapping = autoSuggestMapping(
    ["HES ID", "Customer Name", "System Size (kW)", "Payment Status", "C0 Paid"],
    "projects",
  );

  assert.equal(mapping["HES ID"], "project_id");
  assert.equal(mapping["Customer Name"], "opportunity_name");
  assert.equal(mapping["System Size (kW)"], "system_size_kw");
  assert.equal(mapping["Payment Status"], "payment_status");
  assert.equal(mapping["C0 Paid"], "c0_paid");
});
