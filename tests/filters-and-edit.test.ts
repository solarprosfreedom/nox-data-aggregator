import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeColumnFilter,
  decodeMultiSelectFilter,
  encodeColumnFilter,
  encodeMultiSelectFilter,
  legacyParamsToColumnFilters,
  matchesColumnFilter,
} from "@/lib/data-hub/column-filters";
import {
  buildRemittanceUpdatePayload,
  remittanceFormHasValues,
  type ProjectFormData,
} from "@/lib/data-hub/project-edit-form";

test("column filter encoding round-trips advanced and multiselect filters", () => {
  const encoded = encodeColumnFilter({
    c1: { op: "contains", value: "Axia Solar" },
    logic: "or",
    c2: { op: "isempty", value: "" },
  });

  assert.deepEqual(decodeColumnFilter(encoded), {
    c1: { op: "contains", value: "Axia Solar" },
    logic: "or",
    c2: { op: "isempty", value: "" },
  });
  assert.deepEqual(
    decodeMultiSelectFilter(encodeMultiSelectFilter(["Jonas Lim", "Adrian Trevino"])),
    ["Jonas Lim", "Adrian Trevino"],
  );
});

test("matchesColumnFilter handles text and number filters", () => {
  assert.equal(
    matchesColumnFilter(
      "Axia Solar Corp",
      { c1: { op: "contains", value: "solar" }, logic: "and" },
      "text",
    ),
    true,
  );
  assert.equal(
    matchesColumnFilter(
      6.88,
      { c1: { op: "eq", value: "6.88" }, logic: "and" },
      "number",
    ),
    true,
  );
  assert.equal(
    matchesColumnFilter(
      null,
      { c1: { op: "isempty", value: "" }, logic: "and" },
      "text",
    ),
    true,
  );
});

test("legacy project filter params convert to column filters", () => {
  assert.deepEqual(
    legacyParamsToColumnFilters({
      setter: "Jonas Lim",
      salesRep: "Adrian Trevino",
      status: "Install",
      installer: "Axia Solar Corp",
    }),
    {
      advanced: {
        project_stage: {
          c1: { op: "contains", value: "Install" },
          logic: "and",
        },
        installer: {
          c1: { op: "eq", value: "Axia Solar Corp" },
          logic: "and",
        },
      },
      multiSelect: {
        setter_name: ["Jonas Lim"],
        sales_rep: ["Adrian Trevino"],
      },
    },
  );
});

test("remittance edit payload parses numbers and supports null clearing", () => {
  const form = {
    remittance_id: "",
    c0: "$1,000.50",
    c1: "",
    payment_status: "Paid",
    finance_type: "",
  } satisfies ProjectFormData;

  assert.equal(remittanceFormHasValues(form), true);
  const payload = buildRemittanceUpdatePayload(form);
  assert.equal(payload.c0, 1000.5);
  assert.equal(payload.c1, null);
  assert.equal(payload.payment_status, "Paid");
  assert.equal(payload.finance_type, null);
});
