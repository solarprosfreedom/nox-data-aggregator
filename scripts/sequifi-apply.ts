import { config } from "dotenv";
import { resolve } from "path";
import { runSequifiSync } from "../lib/sequifi/sync";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("Starting Sequifi APPLY sync at", new Date().toISOString());
  const r = await runSequifiSync({ dryRun: false });
  if ("error" in r) {
    console.error("ERROR:", r.error);
    process.exit(1);
  }
  console.log(`Projects scanned:     ${r.projectsScanned}`);
  console.log(`Sequifi sales:        ${r.sequifiSales}`);
  console.log(`Updated Sequifi:      ${r.pushedUpdate}`);
  console.log(`Created Sequifi:      ${r.pushedNew}`);
  console.log(`Skipped (missing):    ${r.skippedMissingFields}`);
  console.log(`Skipped (ambiguous):  ${r.ambiguous}`);
  console.log(`Errors:               ${r.errors}`);
  if (r.errorMessages.length) {
    console.log("\nError samples:");
    r.errorMessages.forEach((m) => console.log(`  ${m}`));
  }
  console.log("\nDone at", new Date().toISOString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
