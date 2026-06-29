/**
 * Sequifi payload test — preview or POST a single sale record.
 *
 *   npx tsx scripts/sequifi-test-push.ts              # dry-run: build payload + sync preview
 *   npx tsx scripts/sequifi-test-push.ts --send       # POST test record to Sequifi
 *   npx tsx scripts/sequifi-test-push.ts --pid HES-071602
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { buildSequifiUpsertRecord } from "../lib/sequifi/build-upsert-record";
import { upsertSequifiSales } from "../lib/sequifi/client";
import type { RemittanceSummary } from "../lib/data-hub/queries";

config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const send = args.includes("--send");
const pidArg = args.find((a) => a.startsWith("--pid="))?.split("=")[1]
  ?? (args.includes("--pid") ? args[args.indexOf("--pid") + 1] : undefined)
  ?? "HES-1115563";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

async function loadProjectAndRemittance(projectId: string) {
  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  const { data: project, error: projectErr } = await db
    .from("projects")
    .select(
      "id, project_id, opportunity_name, state_code, address_line1, postal_code, system_size_kw, total_system_cost, contract_signed_date, installer, project_stage, net_epc, setter_name, setter_email, closer_name, closer_email, sales_advisor_name, sales_advisor_email, setter_sequifi_employee_id, closer_sequifi_employee_id",
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (projectErr) throw new Error(projectErr.message);
  if (!project) return { project: null, remit: null };

  const { data: rpcData, error: rpcErr } = await db.rpc("latest_remittance_for_projects", {
    project_ids: [project.id],
  });
  if (rpcErr) throw new Error(rpcErr.message);

  const raw = (rpcData?.[0] ?? null) as Record<string, unknown> | null;
  let remit: RemittanceSummary | null = null;
  if (raw) {
    const { project_id: _p, ...summary } = raw;
    remit = summary as RemittanceSummary;
  }

  return { project, remit };
}

/** Sample payload when project is missing in DB (Maria Test shape). */
function sampleTestRecord() {
  return {
    pid: "HES-TEST-SAMPLE",
    customer_name: "Maria Test",
    kw: 9.89,
    customer_signoff: "2026-05-22",
    customer_state: "CA",
    location_code: "CA.Axia",
    gross_account_value: 48559.9,
    install_partner: "Axia Solar Corp",
    job_status: "Permitting",
    setter1_name: "Alex Jon Duffy",
    setter1_email: "alexduffy@noxpwr.com",
    closer1_name: "Alex Duffy",
    closer1_email: "alexduffy@noxpwr.com",
    closer1_id: 43,
    gross_epc: 4.91,
    net_epc: 3.68,
    adders: 250,
    finance_type: "TPO - Monthly",
    financier: "Enfin",
    payment_status: "M1 Paid",
    total_commission: 15641,
    total_paid_to_date: 5000,
    remittance_payment_date: "2026-06-12",
    m1_amount: 3000,
    m2_amount: 2000,
    m3_amount: 10641,
    adjusted_m3_amount: 15091,
    m1_paid: 3000,
    m2_paid: 2000,
    m3_paid: 0,
    m1_payable_date: "2026-06-12",
    m2_payable_date: "2026-06-12",
  };
}

async function syncDryRunSummary() {
  const { syncWithSequifi } = await import("../app/(dashboard)/sync/sequifi-actions");
  const result = await syncWithSequifi({ dryRun: true });
  if ("error" in result) {
    console.error("\nFull sync dry-run error:", result.error);
    return;
  }
  console.log("\n--- Full sync dry-run (all projects) ---");
  console.log(`Projects scanned: ${result.projectsScanned}`);
  console.log(`Sequifi sales:    ${result.sequifiSales}`);
  console.log(`Would update:     ${result.pushedUpdate}`);
  console.log(`Would create:     ${result.pushedNew}`);
  console.log(`Would pull:       ${result.pulledNew}`);
  console.log(`Skipped (missing required fields): ${result.skippedMissingFields}`);
  console.log(`Ambiguous matches: ${result.ambiguous}`);
  if (result.samples.update.length) {
    console.log("Sample updates:", result.samples.update.slice(0, 3).join(" | "));
  }
}

async function main() {
  console.log(`Sequifi test — pid=${pidArg} mode=${send ? "SEND" : "DRY-RUN"}\n`);

  const { project, remit } = await loadProjectAndRemittance(pidArg);

  let record;
  if (project) {
    console.log(`Found project: ${project.project_id} — ${project.opportunity_name}`);
    console.log(`Remittance linked: ${remit ? "yes" : "no"}`);
    record = buildSequifiUpsertRecord(project, project.project_id!, false, remit);
    if (!record) {
      console.error("Could not build record — missing required fields (name, kw, signoff, state).");
      process.exit(1);
    }
  } else {
    console.log(`Project ${pidArg} not in DB — using built-in sample test record.`);
    record = sampleTestRecord();
  }

  const body = { data: [record] };
  console.log("\n--- Payload to POST /v1/sales ---");
  console.log(JSON.stringify(body, null, 2));

  if (!send) {
    await syncDryRunSummary();
    console.log("\nDry-run only. Re-run with --send to POST this record to Sequifi.");
    return;
  }

  console.log("\n--- POSTing to Sequifi ---");
  const outcome = await upsertSequifiSales([record]);
  console.log(JSON.stringify({
    processed: outcome.processed,
    inserted: outcome.inserted,
    patched: outcome.patched,
    succeeded: [...outcome.succeededPids],
    errors: outcome.errors,
  }, null, 2));

  if (outcome.errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
