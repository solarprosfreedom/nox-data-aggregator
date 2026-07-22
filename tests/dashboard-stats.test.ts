import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardStats } from "@/lib/data-hub/dashboard-stats";
import type { PublicDealRow } from "@/lib/public-deals/client";

test("buildDashboardStats groups project counts by installer endpoint", () => {
  const rows: PublicDealRow[] = [
    {
      vendor: "axia",
      installer: "Axia",
      pk: "hes_id",
      pk_value: "HES-1",
      project: {
        project_id: "HES-1",
        opportunity_name: "Ada Lovelace",
        state_code: "CA",
        system_size_kw: 6.5,
        contract_signed_date: "2026-07-01",
        project_stage: "Installation",
        updated_at: "2026-07-05T12:00:00.000Z",
      },
      remittance: {
        payment_status: "Paid",
        c0: 100,
        c0_paid: 100,
      },
    },
    {
      vendor: "axia",
      installer: "Axia",
      pk: "hes_id",
      pk_value: "HES-2",
      project: {
        project_id: "HES-2",
        opportunity_name: "Grace Hopper",
        project_stage: "Design",
        updated_at: "2026-07-03T12:00:00.000Z",
      },
      remittance: null,
    },
    {
      vendor: "goodpwr",
      installer: "GoodPwr",
      pk: "project_id",
      pk_value: "G-1",
      project: {
        project_id: "G-1",
        opportunity_name: "Katherine Johnson",
        state_code: "AZ",
        system_size_kw: 4.25,
        contract_signed_date: "2026-07-02",
        project_stage: "Installation",
      },
      remittance: {
        payment_status: "Pending",
        c1: 200,
      },
    },
    {
      vendor: "owe",
      installer: "OWE",
      pk: "pid",
      pk_value: "OUR-1",
      project: {
        project_id: "OUR-1",
        opportunity_name: "Dorothy Vaughan",
        project_stage: "install",
      },
      remittance: null,
    },
  ];

  const stats = buildDashboardStats(rows);
  const axia = stats.installerStats.find((row) => row.vendor === "axia");
  const goodpwr = stats.installerStats.find((row) => row.vendor === "goodpwr");
  const illum = stats.installerStats.find((row) => row.vendor === "illum");

  assert.equal(stats.totalProjects, 4);
  assert.equal(stats.withRemittance, 2);

  assert.equal(axia?.count, 2);
  assert.equal(axia?.withRemittance, 1);
  assert.equal(axia?.latestUpdated, "2026-07-05T12:00:00.000Z");

  assert.equal(goodpwr?.count, 1);
  assert.equal(illum?.count, 0);

  assert.deepEqual(stats.stageStats.slice(0, 2), [
    { label: "Installation", count: 3 },
    { label: "Design", count: 1 },
  ]);
});

test("buildDashboardStats returns every project stage bucket", () => {
  const rows: PublicDealRow[] = Array.from({ length: 14 }, (_, index) => ({
    vendor: "axia",
    installer: "Axia",
    pk: "hes_id",
    pk_value: `HES-${index}`,
    project: {
      project_id: `HES-${index}`,
      opportunity_name: `Project ${index}`,
      project_stage: `Stage ${index}`,
    },
    remittance: null,
  }));

  const stats = buildDashboardStats(rows);

  assert.equal(stats.stageStats.length, 14);
  assert.equal(
    stats.stageStats.reduce((sum, row) => sum + row.count, 0),
    stats.totalProjects,
  );
});

test("buildDashboardStats groups NTP with Notice to Proceed", () => {
  const rows: PublicDealRow[] = [
    {
      vendor: "axia",
      installer: "Axia",
      pk: "hes_id",
      pk_value: "HES-NTP-1",
      project: {
        project_id: "HES-NTP-1",
        opportunity_name: "NTP project",
        project_stage: "NTP",
      },
      remittance: null,
    },
    {
      vendor: "axia",
      installer: "Axia",
      pk: "hes_id",
      pk_value: "HES-NTP-2",
      project: {
        project_id: "HES-NTP-2",
        opportunity_name: "Notice project",
        project_stage: "Notice to Proceed",
      },
      remittance: null,
    },
    {
      vendor: "axia",
      installer: "Axia",
      pk: "hes_id",
      pk_value: "HES-NTP-3",
      project: {
        project_id: "HES-NTP-3",
        opportunity_name: "Checked NTP project",
        project_stage: "✔ NTP",
      },
      remittance: null,
    },
  ];

  const stats = buildDashboardStats(rows);

  assert.deepEqual(stats.stageStats, [
    { label: "Notice to Proceed", count: 3 },
  ]);
});
