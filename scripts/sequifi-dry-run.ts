import { config } from "dotenv";
import { resolve } from "path";
import { runSequifiSync } from "../lib/sequifi/sync";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const result = await runSequifiSync({ dryRun: true });
  if ("error" in result) {
    throw new Error(result.error);
  }

  console.log("=== Endpoint-to-Sequifi dry run ===");
  console.log(`Projects scanned: ${result.projectsScanned}`);
  console.log(`Sequifi sales: ${result.sequifiSales}`);
  console.log(`Would update: ${result.pushedUpdate}`);
  console.log(`Would create: ${result.pushedNew}`);
  console.log(`Missing required fields: ${result.skippedMissingFields}`);
  console.log(`Ambiguous matches: ${result.ambiguous}`);

  if (result.samples.update.length) {
    console.log("\nSample updates:");
    result.samples.update.forEach((sample) => console.log(`  ${sample}`));
  }
  if (result.samples.create.length) {
    console.log("\nSample creates:");
    result.samples.create.forEach((sample) => console.log(`  ${sample}`));
  }

  console.log("\nNo data was written.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
