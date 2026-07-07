import assert from "node:assert/strict";
import test from "node:test";
import { buildCoperniqWebhookRow } from "@/lib/coperniq/webhook";

test("buildCoperniqWebhookRow stores raw payload and maps normalized fields", () => {
  const payload = {
    event: {
      eventId: 48291,
      recordId: 10423,
      triggerKey: "TASK_STATUS_MOVEMENT",
      triggerName: "Work Order Status Movement",
      firedAt: "2026-03-31T17:04:22.000Z",
      workOrderId: 8812,
      currentStatus: "COMPLETED",
      previousStatus: "IN_PROGRESS",
    },
    record: {
      id: 10423,
      uid: 3301,
      type: "PROJECT",
      title: "Jane Homeowner",
      status: "ACTIVE",
      requestStatus: null,
      stage: { id: 16651, name: "Installation" },
      address: "123 Main St Austin TX 78701",
      city: "Austin",
      state: "TX",
      dealValue: 28500,
      primaryEmail: "HOMEOWNER@EXAMPLE.COM",
      systemSizeKw: "8.64 kW",
      contractSignedDate: "2026-01-15T14:30:00.000Z",
      installDate: "2026-03-31",
      setter: {
        name: "Sam Setter",
        email: "sam@example.com",
      },
      salesRep: {
        name: "Alex Rep",
        email: "alex@example.com",
      },
      financeType: "Loan",
      grossPpw: "3.30",
      netPpw: "2.90",
      adders: "$1,250.50",
      createdAt: "2026-01-15T14:30:00.000Z",
      updatedAt: "2026-03-31T17:04:22.000Z",
    },
    workOrder: {
      id: 8812,
      uid: 204,
      title: "Panel Installation",
      status: "COMPLETED",
      recordId: 10423,
      completionDate: "2026-03-31T17:04:22.000Z",
    },
  };
  const rawBody = JSON.stringify(payload);

  const row = buildCoperniqWebhookRow({
    payload,
    rawBody,
    requestHeaders: { "content-type": "application/json" },
  });

  assert.equal(row.raw_body, rawBody);
  assert.deepEqual(row.raw_payload, payload);
  assert.equal(row.event_id, "48291");
  assert.equal(row.record_id, "10423");
  assert.equal(row.record_uid, "3301");
  assert.equal(row.record_type, "PROJECT");
  assert.equal(row.trigger_key, "TASK_STATUS_MOVEMENT");
  assert.equal(row.trigger_name, "Work Order Status Movement");
  assert.equal(row.fired_at, "2026-03-31T17:04:22.000Z");
  assert.equal(row.work_order_id, "8812");
  assert.equal(row.project_id, "3301");
  assert.equal(row.customer_name, "Jane Homeowner");
  assert.equal(row.customer_email, "homeowner@example.com");
  assert.equal(row.address, "123 Main St Austin TX 78701");
  assert.equal(row.city, "Austin");
  assert.equal(row.state_code, "TX");
  assert.equal(row.postal_code, "78701");
  assert.equal(row.system_size_kw, 8.64);
  assert.equal(row.contract_signed_date, "2026-01-15");
  assert.equal(row.total_system_cost, 28500);
  assert.equal(row.project_stage, "Installation");
  assert.equal(row.install_date, "2026-03-31");
  assert.equal(row.setter_name, "Sam Setter");
  assert.equal(row.setter_email, "sam@example.com");
  assert.equal(row.sales_rep_name, "Alex Rep");
  assert.equal(row.sales_rep_email, "alex@example.com");
  assert.equal(row.gross_ppw, 3.3);
  assert.equal(row.net_ppw, 2.9);
  assert.equal(row.adders, 1250.5);
  assert.equal(row.finance_type, "Loan");
});
