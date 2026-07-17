import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  runSequifiSync,
  type SequifiSyncAuditEntry,
} from "../lib/sequifi/sync";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const startedAt = new Date().toISOString();
  const audit: SequifiSyncAuditEntry[] = [];
  console.log("Starting Sequifi APPLY sync at", startedAt);
  const r = await runSequifiSync({
    dryRun: false,
    onApplied: (entries) => {
      audit.push(...entries);
    },
  });
  if ("error" in r) {
    console.error("ERROR:", r.error);
    process.exit(1);
  }
  const reportPath = resolve(process.cwd(), "exports", `sequifi-sync-${Date.now()}.json`);
  mkdirSync(resolve(process.cwd(), "exports"), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        summary: {
          projects_scanned: r.projectsScanned,
          sequifi_sales_before_sync: r.sequifiSales,
          created: r.pushedNew,
          updated: r.pushedUpdate,
          new_deals_missing_required_fields: r.skippedMissingFields,
          empty_existing_updates: r.skippedEmptyUpdates,
          ambiguous_matches: r.ambiguous,
          errors: r.errors,
        },
        records: audit,
      },
      null,
      2,
    ),
  );
  console.log(`Projects scanned:     ${r.projectsScanned}`);
  console.log(`Sequifi sales:        ${r.sequifiSales}`);
  console.log(`Updated Sequifi:      ${r.pushedUpdate}`);
  console.log(`Created Sequifi:      ${r.pushedNew}`);
  console.log(`New deals missing fields: ${r.skippedMissingFields}`);
  console.log(`Empty existing updates:   ${r.skippedEmptyUpdates}`);
  console.log(`Skipped (ambiguous):  ${r.ambiguous}`);
  console.log(`Errors:               ${r.errors}`);
  if (r.errorMessages.length) {
    console.log("\nError samples:");
    r.errorMessages.forEach((m) => console.log(`  ${m}`));
  }
  console.log(`Audit log:            ${reportPath}`);
  console.log("\nDone at", new Date().toISOString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
