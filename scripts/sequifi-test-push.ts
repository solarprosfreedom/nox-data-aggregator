/**
 * Preview or safely update one existing Sequifi sale from the endpoint source.
 *
 *   npx tsx scripts/sequifi-test-push.ts --pid HES-1117996
 *   npx tsx scripts/sequifi-test-push.ts --pid HES-1117996 --send
 */
import { config } from "dotenv";
import { resolve } from "path";
import { listEndpointProjects } from "../lib/data-hub/queries";
import { buildSequifiUpsertRecord } from "../lib/sequifi/build-upsert-record";
import { fetchAllSequifiSales, upsertSequifiSales } from "../lib/sequifi/client";
import { buildSalesIndex, matchProjectToSale } from "../lib/sequifi/matcher";

config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const send = args.includes("--send");
const pidArg = args.find((arg) => arg.startsWith("--pid="))?.split("=")[1]
  ?? (args.includes("--pid") ? args[args.indexOf("--pid") + 1] : undefined);

async function main() {
  if (!pidArg?.trim()) {
    throw new Error("Pass an endpoint project ID: --pid <project_id>");
  }

  const project = (await listEndpointProjects()).find(
    (row) => row.project_id === pidArg,
  );
  if (!project) throw new Error(`Endpoint project not found: ${pidArg}`);

  const sales = await fetchAllSequifiSales();
  const match = matchProjectToSale(project, buildSalesIndex(sales));
  if (match.kind !== "matched") {
    throw new Error(
      "Refusing test push: project is not a confirmed existing Sequifi sale.",
    );
  }

  const record = buildSequifiUpsertRecord(
    project,
    match.sale.pid,
    false,
    project.remittance,
  );
  if (!record) {
    throw new Error("Missing required Sequifi fields (name, kW, signoff date, or state).");
  }

  console.log(JSON.stringify({
    projectId: project.project_id,
    matchedBy: match.matchedBy,
    sequifiPid: match.sale.pid,
    payload: { data: [record] },
  }, null, 2));

  if (!send) {
    console.log("\nPreview only. Pass --send to update this existing PID.");
    return;
  }

  const outcome = await upsertSequifiSales([record]);
  if (outcome.errors.length) throw new Error(JSON.stringify(outcome.errors));

  const after = await fetchAllSequifiSales();
  const matchingSales = after.filter((sale) => sale.pid === match.sale.pid);
  if (matchingSales.length !== 1) {
    throw new Error(`Expected exactly one sale for ${match.sale.pid}; found ${matchingSales.length}.`);
  }
  console.log(`\nUpdated existing Sequifi PID ${match.sale.pid} without a duplicate.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
