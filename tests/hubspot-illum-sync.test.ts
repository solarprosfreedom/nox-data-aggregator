import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIllumDealSearchFilters,
  mapIllumDealToProjectRow,
  type HubSpotDeal,
} from "@/lib/hubspot/illum-sync";

test("buildIllumDealSearchFilters scopes Illum sync to The Mambas", () => {
  const filters = buildIllumDealSearchFilters(1782835200000);

  assert.deepEqual(filters, [
    { propertyName: "pipeline", operator: "EQ", value: "default" },
    { propertyName: "dealname", operator: "CONTAINS_TOKEN", value: "Mambas" },
    {
      propertyName: "hs_lastmodifieddate",
      operator: "GT",
      value: "1782835200000",
    },
  ]);
  assert.equal(filters.some((filter) => filter.propertyName === "closedate"), false);
});

test("mapIllumDealToProjectRow maps HubSpot Mambas fields to endpoint payload", () => {
  const deal: HubSpotDeal = {
    id: "333905120970",
    properties: {
      hs_object_id: "333905120970",
      amount: "21677.5",
      dealname: "Aaron Dolce - 1504 Waterwheel Dr Sacramento-The Mambas ()",
      dealstage: "contract-signed",
      pipeline: "default",
      contact_name: "Aaron Dolce",
      street_address: "1504 Waterwheel Dr",
      city: "Sacramento",
      postal_code: "95833",
      phone_number: "9168733822",
      sales_rep: "rep-owner-id",
      sales_rep_name__deal_: "Tanner Paepke",
      sales_rep_email__deal_: "tanner@example.com",
      sales_rep_setter_name: "Kaden Walker",
      sales_rep_setter_email: "kaden@example.com",
      system_size_in_kw: "6.8",
      closedate: "2026-07-01T22:35:00.000Z",
      hs_lastmodifieddate: "2026-07-02T06:33:00.000Z",
    },
  };

  const mapped = mapIllumDealToProjectRow(
    deal,
    {
      byPipelineStage: new Map([["default:contract-signed", "Contract Signed"]]),
      byStage: new Map(),
    },
    new Map([["rep-owner-id", { name: "Fallback Rep", email: "fallback@example.com" }]]),
    new Map([
      [
        "333905120970",
        {
          email: "aaron@example.com",
          firstName: "Aaron",
          lastName: "Dolce",
          phone: "9160000000",
        },
      ],
    ]),
  );

  assert.ok(mapped);
  assert.equal(mapped.project_id, "hubspot_333905120970");
  assert.equal(mapped.opportunity_name, "Aaron Dolce - 1504 Waterwheel Dr Sacramento-The Mambas ()");
  assert.equal(mapped.first_name, "Aaron");
  assert.equal(mapped.last_name, "Dolce");
  assert.equal(mapped.email, "aaron@example.com");
  assert.equal(mapped.phone, "9160000000");
  assert.equal(mapped.address_line1, "1504 Waterwheel Dr");
  assert.equal(mapped.city, "Sacramento");
  assert.equal(mapped.state_code, "CA");
  assert.equal(mapped.postal_code, "95833");
  assert.equal(mapped.project_stage, "Contract Signed");
  assert.equal(mapped.contract_signed_date, "2026-07-01");
  assert.equal(mapped.total_system_cost, 21677.5);
  assert.equal(mapped.system_size_kw, 6.8);
  assert.equal(mapped.sales_advisor_name, "Tanner Paepke");
  assert.equal(mapped.sales_advisor_email, "tanner@example.com");
  assert.equal(mapped.setter_name, "Kaden Walker");
  assert.equal(mapped.setter_email, "kaden@example.com");
  assert.equal(mapped.installer, "Illum");
  assert.equal(mapped.updated_at, "2026-07-02T06:33:00.000Z");
});
