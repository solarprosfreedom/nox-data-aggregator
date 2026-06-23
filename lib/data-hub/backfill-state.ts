import { createServerSupabase } from "@/lib/supabase/server";
import { inferCaliforniaStateFromZip, parseStateCode } from "@/lib/data-hub/normalize";

const PAGE_SIZE = 1000;
const UPDATE_CONCURRENCY = 50;

export type BackfillStateResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

async function applyUpdates(
  db: ReturnType<typeof createServerSupabase>,
  updates: { id: string; state_code: string }[],
): Promise<void> {
  for (let i = 0; i < updates.length; i += UPDATE_CONCURRENCY) {
    const chunk = updates.slice(i, i + UPDATE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(({ id, state_code }) =>
        db.from("projects").update({ state_code }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
}

export async function backfillProjectStateCodes(): Promise<BackfillStateResult> {
  const db = createServerSupabase();
  let scanned = 0;
  let skipped = 0;
  const pending: { id: string; state_code: string }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("projects")
      .select("id, state_code, address_line1, opportunity_name, postal_code")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const current = (row.state_code as string | null)?.trim() || null;
      const resolved =
        parseStateCode(
          row.address_line1 as string | null,
          row.opportunity_name as string | null,
        ) ?? inferCaliforniaStateFromZip(row.postal_code as string | null);

      if (!resolved || resolved === current) {
        skipped += 1;
        continue;
      }

      pending.push({ id: row.id as string, state_code: resolved });
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  await applyUpdates(db, pending);

  return { scanned, updated: pending.length, skipped };
}
