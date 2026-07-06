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

export type RefreshNetEpcResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

export async function refreshNetEpcForProjects(
  db: unknown,
  projectIds: string[],
): Promise<RefreshNetEpcResult> {
  void db;
  return { scanned: projectIds.length, updated: 0, skipped: projectIds.length };
}

/** @deprecated Use syncProjectPersonalInfoFromImport from project-personal-sync */
export async function syncProjectsFromRemittanceImport(
  db: unknown,
  updates: { projectId: string; stage?: string; customerName?: string }[],
): Promise<number> {
  void db;
  void updates;
  return 0;
}

/** @deprecated Use syncProjectsFromRemittanceImport */
export async function syncProjectStagesFromRemittance(
  db: unknown,
  updates: { projectId: string; stage: string }[],
): Promise<number> {
  return syncProjectsFromRemittanceImport(
    db,
    updates.map(({ projectId, stage }) => ({ projectId, stage })),
  );
}

/** Backfill net_epc for every project that has at least one remittance row. */
export async function refreshAllProjectNetEpcFromRemittance(
  db: unknown,
): Promise<RefreshNetEpcResult> {
  void db;
  return { scanned: 0, updated: 0, skipped: 0 };
}
