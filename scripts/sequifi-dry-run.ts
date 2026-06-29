import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runSequifiSync } from "../lib/sequifi/sync";

config({ path: resolve(process.cwd(), ".env.local") });

async function analyzeReadiness() {
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("projects")
      .select(
        "project_id,opportunity_name,system_size_kw,contract_signed_date,state_code,sequifi_sale_id",
      )
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
    from += 1000;
  }

  let missingName = 0;
  let missingKw = 0;
  let missingDate = 0;
  let missingState = 0;
  let missingAny = 0;
  let hasSequifiId = 0;

  for (const r of all) {
    const name =
      typeof r.opportunity_name === "string" && r.opportunity_name.trim();
    const kw = r.system_size_kw;
    const date = r.contract_signed_date;
    const state = typeof r.state_code === "string" && r.state_code.trim();
    const badName = !name;
    const badKw = kw == null;
    const badDate = !date;
    const badState = !state;
    if (badName) missingName++;
    if (badKw) missingKw++;
    if (badDate) missingDate++;
    if (badState) missingState++;
    if (badName || badKw || badDate || badState) missingAny++;
    if (r.sequifi_sale_id) hasSequifiId++;
  }

  console.log("=== Hub readiness (Sequifi required fields) ===");
  console.log(`Total projects:              ${all.length}`);
  console.log(`Already linked (sequifi_sale_id): ${hasSequifiId}`);
  console.log(`Missing customer name:       ${missingName}`);
  console.log(`Missing system size (kW):    ${missingKw}`);
  console.log(`Missing contract date:       ${missingDate}`);
  console.log(`Missing state:               ${missingState}`);
  console.log(`Missing ANY (would skip push): ${missingAny}`);
  console.log(`Ready to push (all 4 fields):  ${all.length - missingAny}`);
}

async function main() {
  await analyzeReadiness();

  console.log("\n=== Sync Sequifi PREVIEW (same as Preview button) ===");
  const r = await runSequifiSync({ dryRun: true });
  if ("error" in r) {
    console.error("ERROR:", r.error);
    process.exit(1);
  }

  console.log(`Projects scanned:     ${r.projectsScanned}`);
  console.log(`Sequifi sales:        ${r.sequifiSales}`);
  console.log(`Would UPDATE Sequifi: ${r.pushedUpdate} (matched existing sales)`);
  console.log(`Would CREATE Sequifi: ${r.pushedNew} (new hub projects)`);
  console.log(`Would PULL to hub:    ${r.pulledNew} (Sequifi-only → new projects)`);
  console.log(`Skipped (missing fields): ${r.skippedMissingFields}`);
  console.log(`Skipped (ambiguous name): ${r.ambiguous}`);
  console.log(`Linked existing matches:  ${r.linkedExisting}`);

  if (r.samples.update.length) {
    console.log("\nSample updates:");
    r.samples.update.forEach((s) => console.log(`  ${s}`));
  }
  if (r.samples.create.length) {
    console.log("\nSample creates:");
    r.samples.create.forEach((s) => console.log(`  ${s}`));
  }
  if (r.samples.pull.length) {
    console.log("\nSample pulls:");
    r.samples.pull.forEach((s) => console.log(`  ${s}`));
  }

  console.log("\nNothing was written (dry run).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
