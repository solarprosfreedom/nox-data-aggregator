import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { backfillProjectStateCodes } = await import(
    "../lib/data-hub/backfill-state"
  );
  const result = await backfillProjectStateCodes();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
