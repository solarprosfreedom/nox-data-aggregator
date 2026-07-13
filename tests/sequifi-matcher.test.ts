import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesIndex, matchProjectToSale } from "@/lib/sequifi/matcher";

test("stored sequifi_pid takes precedence over project ID and name", () => {
  const index = buildSalesIndex([
    {
      id: 42,
      pid: "4552368",
      customer_name: "Ramey Barrios",
      customer_state: "CA",
      kw: 6,
      gross_account_value: null,
      net_epc: null,
      total_commission: null,
      customer_signoff: null,
      install_partner: null,
      job_status: null,
      closer1: null,
      setter1: null,
    },
    {
      id: 43,
      pid: "HUBSPOT-123",
      customer_name: "Different Customer",
      customer_state: "CA",
      kw: 6,
      gross_account_value: null,
      net_epc: null,
      total_commission: null,
      customer_signoff: null,
      install_partner: null,
      job_status: null,
      closer1: null,
      setter1: null,
    },
  ]);

  const match = matchProjectToSale(
    {
      id: "hubspot_123",
      project_id: "HUBSPOT-123",
      opportunity_name: "Ramey Barrios - 1 Test Street",
      sequifi_pid: "4552368",
    },
    index,
  );

  assert.equal(match.kind, "matched");
  if (match.kind !== "matched") return;
  assert.equal(match.matchedBy, "stored_pid");
  assert.equal(match.sale.pid, "4552368");
});
