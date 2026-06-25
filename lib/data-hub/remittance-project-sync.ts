import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNetPpw } from "@/lib/data-hub/ppw";
import type { RemittanceSummary } from "@/lib/data-hub/queries";

type ProjectForNetEpc = {
  id: string;
  total_system_cost: number | null;
  system_size_kw: number | null;
  net_epc: number | null;
};

type RemitLike = Pick<
  RemittanceSummary,
  "ppw" | "battery_price" | "adder_amount"
> | null;

export function resolveNetEpcFromRemittance(
  project: Pick<ProjectForNetEpc, "total_system_cost" | "system_size_kw">,
  remit: RemitLike,
): number | null {
  if (remit?.ppw != null) {
    const ppw = Number(remit.ppw);
    if (Number.isFinite(ppw)) return ppw;
  }
  return computeNetPpw(
    project.total_system_cost,
    project.system_size_kw,
    remit?.battery_price,
    remit?.adder_amount,
  );
}

const REFRESH_CHUNK = 500;

export type RefreshNetEpcResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

export async function refreshNetEpcForProjects(
  db: SupabaseClient,
  projectIds: string[],
): Promise<RefreshNetEpcResult> {
  const uniqueIds = [...new Set(projectIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { scanned: 0, updated: 0, skipped: 0 };
  }

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < uniqueIds.length; i += REFRESH_CHUNK) {
    const chunkIds = uniqueIds.slice(i, i + REFRESH_CHUNK);

    const { data: projects, error: projectErr } = await db
      .from("projects")
      .select("id, total_system_cost, system_size_kw, net_epc")
      .in("id", chunkIds);

    if (projectErr) throw new Error(projectErr.message);

    const { data: remitRows, error: remitErr } = await db.rpc(
      "latest_remittance_for_projects",
      { project_ids: chunkIds },
    );

    if (remitErr) throw new Error(remitErr.message);

    const remitByProject = new Map<string, RemitLike>();
    for (const raw of (remitRows ?? []) as Record<string, unknown>[]) {
      const pid = raw.project_id as string | null;
      if (pid && !remitByProject.has(pid)) {
        remitByProject.set(pid, {
          ppw: raw.ppw as number | null,
          battery_price: raw.battery_price as number | null,
          adder_amount: raw.adder_amount as number | null,
        });
      }
    }

    for (const project of (projects ?? []) as ProjectForNetEpc[]) {
      scanned += 1;
      const remit = remitByProject.get(project.id) ?? null;
      const resolved = resolveNetEpcFromRemittance(project, remit);
      const current =
        project.net_epc == null ? null : Number(project.net_epc);

      if (resolved == null || !Number.isFinite(resolved)) {
        skipped += 1;
        continue;
      }

      if (current != null && current === resolved) {
        skipped += 1;
        continue;
      }

      const { error: updateErr } = await db
        .from("projects")
        .update({ net_epc: resolved })
        .eq("id", project.id);

      if (updateErr) throw new Error(updateErr.message);
      updated += 1;
    }
  }

  return { scanned, updated, skipped };
}

/** Backfill net_epc for every project that has at least one remittance row. */
export async function refreshAllProjectNetEpcFromRemittance(
  db: SupabaseClient,
): Promise<RefreshNetEpcResult> {
  const projectIds: string[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("remittance")
      .select("project_id")
      .not("project_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    for (const row of rows) {
      const id = (row as { project_id: string | null }).project_id;
      if (id) projectIds.push(id);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return refreshNetEpcForProjects(db, projectIds);
}
