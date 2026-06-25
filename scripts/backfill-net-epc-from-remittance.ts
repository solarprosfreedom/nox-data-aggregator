import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const { refreshAllProjectNetEpcFromRemittance } = await import(
    "@/lib/data-hub/remittance-project-sync"
  );
  const db = createServerSupabase();
  const result = await refreshAllProjectNetEpcFromRemittance(db);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
