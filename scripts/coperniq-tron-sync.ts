/**
 * Coperniq → live Tron public-deals sync.
 *
 *   npx tsx scripts/coperniq-tron-sync.ts          # preview only
 *   npx tsx scripts/coperniq-tron-sync.ts --apply  # perform inserts and updates
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { runCoperniqTronSync } from "../lib/coperniq/tron-sync";

config({ path: resolve(process.cwd(), ".env.local") });

const dryRun = !process.argv.includes("--apply");

runCoperniqTronSync({ dryRun })
  .then((result) => {
    console.log(JSON.stringify({ dryRun, ...result }, null, 2));
    if (result.errors.length > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
