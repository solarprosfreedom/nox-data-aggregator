import { createServerSupabase } from "@/lib/supabase/server";
import {
  fetchAllSequifiSales,
  upsertSequifiSales,
  type SequifiSale,
  type SequifiUpsertRecord,
} from "@/lib/sequifi/client";
import {
  buildSalesIndex,
  matchProjectToSale,
  normalizeName,
  repName,
} from "@/lib/sequifi/matcher";
import { buildSequifiUpsertRecord } from "@/lib/sequifi/build-upsert-record";
import type { RemittanceSummary } from "@/lib/data-hub/queries";

type ProjectRow = {
  id: string;
  project_id: string | null;
  opportunity_name: string | null;
  sequifi_sale_id: string | null;
  state_code: string | null;
  address_line1: string | null;
  postal_code: string | null;
  system_size_kw: number | null;
  total_system_cost: number | null;
  contract_signed_date: string | null;
  installer: string | null;
  project_stage: string | null;
  net_epc: number | null;
  setter_name: string | null;
  setter_email: string | null;
  closer_name: string | null;
  closer_email: string | null;
  sales_advisor_name: string | null;
  sales_advisor_email: string | null;
  setter_sequifi_employee_id: string | null;
  closer_sequifi_employee_id: string | null;
};

export type SequifiSyncResult = {
  dryRun: boolean;
  projectsScanned: number;
  sequifiSales: number;
  pushedUpdate: number;
  pushedNew: number;
  pulledNew: number;
  linkedExisting: number;
  ambiguous: number;
  skippedMissingFields: number;
  errors: number;
  errorMessages: string[];
  samples: { update: string[]; create: string[]; pull: string[] };
};

export type SequifiSyncResponse = SequifiSyncResult | { error: string };

const PROJECT_COLUMNS =
  "id, project_id, opportunity_name, sequifi_sale_id, state_code, address_line1, postal_code, system_size_kw, total_system_cost, contract_signed_date, installer, project_stage, net_epc, setter_name, setter_email, closer_name, closer_email, sales_advisor_name, sales_advisor_email, setter_sequifi_employee_id, closer_sequifi_employee_id";

const LINK_PARALLEL = 40;

async function loadLatestRemittanceByProject(
  db: ReturnType<typeof createServerSupabase>,
  projectIds: string[],
): Promise<Map<string, RemittanceSummary>> {
  const out = new Map<string, RemittanceSummary>();
  const chunkSize = 500;

  for (let i = 0; i < projectIds.length; i += chunkSize) {
    const chunk = projectIds.slice(i, i + chunkSize);
    const { data, error } = await db.rpc("latest_remittance_for_projects", {
      project_ids: chunk,
    });
    if (error) throw new Error(error.message);

    for (const raw of (data ?? []) as Record<string, unknown>[]) {
      const pid = raw.project_id as string | null;
      if (pid && !out.has(pid)) {
        const { project_id: _ignored, id: _id, ...summary } = raw;
        out.set(pid, summary as RemittanceSummary);
      }
    }
  }

  return out;
}

async function loadAllProjects(
  db: ReturnType<typeof createServerSupabase>,
): Promise<ProjectRow[]> {
  const all: ProjectRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("projects")
      .select(PROJECT_COLUMNS)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ProjectRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function buildProjectFromSale(sale: SequifiSale): Record<string, unknown> {
  const row: Record<string, unknown> = {
    project_id: sale.pid,
    sequifi_sale_id: sale.pid,
    opportunity_name: sale.customer_name,
    state_code: sale.customer_state,
    system_size_kw: sale.kw,
    total_system_cost: sale.gross_account_value,
    contract_signed_date: sale.customer_signoff ? sale.customer_signoff.slice(0, 10) : null,
    installer: sale.install_partner,
    closer_name: repName(sale.closer1),
    setter_name: repName(sale.setter1),
    closer_sequifi_employee_id: sale.closer1 ? String(sale.closer1.id) : null,
    setter_sequifi_employee_id: sale.setter1 ? String(sale.setter1.id) : null,
    sequifi_job_status: sale.job_status,
    sequifi_total_commission: sale.total_commission,
    sequifi_synced_at: new Date().toISOString(),
  };
  if (sale.net_epc != null) row.net_epc = sale.net_epc;
  return row;
}

async function linkPushedProjects(
  db: ReturnType<typeof createServerSupabase>,
  pushApply: {
    id: string;
    pid: string;
    isNew: boolean;
    sequifi_job_status: string | null;
  }[],
  succeededPids: Set<string>,
  syncedAt: string,
): Promise<{
  pushedNew: number;
  pushedUpdate: number;
  errors: { id: string; message: string }[];
}> {
  const toLink = pushApply.filter((item) => succeededPids.has(item.pid));
  let pushedNew = 0;
  let pushedUpdate = 0;
  const errors: { id: string; message: string }[] = [];

  for (let i = 0; i < toLink.length; i += LINK_PARALLEL) {
    const chunk = toLink.slice(i, i + LINK_PARALLEL);
    const results = await Promise.all(
      chunk.map(async (item) => {
        const { error } = await db
          .from("projects")
          .update({
            sequifi_sale_id: item.pid,
            sequifi_job_status: item.sequifi_job_status,
            sequifi_synced_at: syncedAt,
          })
          .eq("id", item.id);
        return { item, error };
      }),
    );

    for (const { item, error } of results) {
      if (error) errors.push({ id: item.id, message: error.message });
      else if (item.isNew) pushedNew++;
      else pushedUpdate++;
    }
  }

  return { pushedNew, pushedUpdate, errors };
}

export async function runSequifiSync({
  dryRun,
}: {
  dryRun: boolean;
}): Promise<SequifiSyncResponse> {
  const result: SequifiSyncResult = {
    dryRun,
    projectsScanned: 0,
    sequifiSales: 0,
    pushedUpdate: 0,
    pushedNew: 0,
    pulledNew: 0,
    linkedExisting: 0,
    ambiguous: 0,
    skippedMissingFields: 0,
    errors: 0,
    errorMessages: [],
    samples: { update: [], create: [], pull: [] },
  };

  try {
    const db = createServerSupabase();
    const projects = await loadAllProjects(db);
    result.projectsScanned = projects.length;

    const remittanceByProject = await loadLatestRemittanceByProject(
      db,
      projects.map((p) => p.id),
    );

    const sales = await fetchAllSequifiSales();
    result.sequifiSales = sales.length;
    const index = buildSalesIndex(sales);

    const projectNames = new Set<string>();
    for (const p of projects) {
      const n = normalizeName(p.opportunity_name);
      if (n) projectNames.add(n);
    }

    const pushRecords: SequifiUpsertRecord[] = [];
    const pushApply: {
      id: string;
      pid: string;
      isNew: boolean;
      sequifi_job_status: string | null;
    }[] = [];

    for (const p of projects) {
      const m = matchProjectToSale(p, index);

      if (m.kind === "ambiguous") {
        result.ambiguous++;
        continue;
      }

      if (m.kind === "matched") {
        result.linkedExisting++;
        const pid = m.sale.pid;
        const rec = buildSequifiUpsertRecord(
          p,
          pid,
          false,
          remittanceByProject.get(p.id) ?? null,
        );
        if (!rec) {
          result.skippedMissingFields++;
          continue;
        }
        pushRecords.push(rec);
        pushApply.push({ id: p.id, pid, isNew: false, sequifi_job_status: m.sale.job_status });
        if (result.samples.update.length < 10) {
          result.samples.update.push(`${p.project_id} -> pid ${pid} (${p.opportunity_name})`);
        }
      } else {
        const pid = p.project_id?.trim();
        const rec = pid
          ? buildSequifiUpsertRecord(
              p,
              pid,
              true,
              remittanceByProject.get(p.id) ?? null,
            )
          : null;
        if (!pid || !rec) {
          result.skippedMissingFields++;
          continue;
        }
        pushRecords.push(rec);
        pushApply.push({ id: p.id, pid, isNew: true, sequifi_job_status: "Pending" });
        if (result.samples.create.length < 10) {
          result.samples.create.push(`${pid} (${p.opportunity_name})`);
        }
      }
    }

    const pushedPids = new Set(pushApply.map((x) => x.pid));
    const pullInserts: Record<string, unknown>[] = [];
    for (const sale of sales) {
      if (pushedPids.has(sale.pid)) continue;
      const n = normalizeName(sale.customer_name);
      if (n && projectNames.has(n)) continue;
      pullInserts.push(buildProjectFromSale(sale));
      if (result.samples.pull.length < 10) {
        result.samples.pull.push(`${sale.pid} (${sale.customer_name})`);
      }
    }

    if (dryRun) {
      result.pushedUpdate = pushApply.filter((x) => !x.isNew).length;
      result.pushedNew = pushApply.filter((x) => x.isNew).length;
      result.pulledNew = pullInserts.length;
      return result;
    }

    if (pushRecords.length) {
      const outcome = await upsertSequifiSales(pushRecords);
      result.errors += outcome.errors.length;
      for (const e of outcome.errors) {
        if (result.errorMessages.length < 15) {
          result.errorMessages.push(`push ${e.pid}: ${e.message}`);
        }
      }

      const syncedAt = new Date().toISOString();
      const linked = await linkPushedProjects(
        db,
        pushApply,
        outcome.succeededPids,
        syncedAt,
      );
      result.pushedNew = linked.pushedNew;
      result.pushedUpdate = linked.pushedUpdate;
      result.errors += linked.errors.length;
      for (const e of linked.errors) {
        if (result.errorMessages.length < 15) {
          result.errorMessages.push(`link ${e.id}: ${e.message}`);
        }
      }
    }

    if (pullInserts.length) {
      const chunkSize = 500;
      for (let i = 0; i < pullInserts.length; i += chunkSize) {
        const chunk = pullInserts.slice(i, i + chunkSize);
        const { error: insErr } = await db
          .from("projects")
          .upsert(chunk, { onConflict: "project_id" });
        if (insErr) {
          result.errors++;
          if (result.errorMessages.length < 15) {
            result.errorMessages.push(`pull batch ${i}: ${insErr.message}`);
          }
        } else {
          result.pulledNew += chunk.length;
        }
      }
    }

    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sequifi sync failed." };
  }
}
