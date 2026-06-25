"use server";

import { revalidatePath } from "next/cache";
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
import type { RemittanceSummary } from "@/lib/data-hub/queries";

// Supabase is the source of truth. This reconcile:
//  - links projects to existing Sequifi sales (by pid, then customer name)
//  - pushes app data to Sequifi (update linked sales, create missing ones)
//  - pulls Sequifi-only sales into Supabase as new (sparse) projects
//
// dryRun computes the full plan and writes nothing, so it can be previewed.

type ProjectRow = {
  id: string;
  project_id: string | null;
  opportunity_name: string | null;
  sequifi_sale_id: string | null;
  state_code: string | null;
  system_size_kw: number | null;
  total_system_cost: number | null;
  contract_signed_date: string | null;
  installer: string | null;
  project_stage: string | null;
  net_epc: number | null;
  setter_name: string | null;
  closer_name: string | null;
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
  "id, project_id, opportunity_name, sequifi_sale_id, state_code, system_size_kw, total_system_cost, contract_signed_date, installer, project_stage, net_epc, setter_name, closer_name, setter_sequifi_employee_id, closer_sequifi_employee_id";

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
  db: ReturnType<typeof createServerSupabase>
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

function fmtDate(v: string | null): string | null {
  if (!v) return null;
  const d = v.length >= 10 ? v.slice(0, 10) : v;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function parseSequifiEmployeeId(value: string | null | undefined): number | null {
  const n = Number(value?.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveJobStatus(
  p: ProjectRow,
  remit: RemittanceSummary | null,
  isNew: boolean,
): string | null {
  const stage = p.project_stage?.trim();
  if (stage) return stage;
  const remitStatus = remit?.status?.trim();
  if (remitStatus) return remitStatus;
  if (isNew) return "Pending";
  return null;
}

// Builds a Solar-valid upsert record, or null if a required field is missing.
function buildUpsertRecord(
  p: ProjectRow,
  pid: string,
  isNew: boolean,
  remit: RemittanceSummary | null,
): SequifiUpsertRecord | null {
  const customer_name = p.opportunity_name?.trim();
  const system_size_kw = p.system_size_kw;
  const customer_signoff = fmtDate(p.contract_signed_date);
  const customer_state = p.state_code?.trim();
  if (!customer_name || system_size_kw == null || !customer_signoff || !customer_state) return null;

  const rec: SequifiUpsertRecord = {
    pid,
    customer_name,
    system_size_kw,
    customer_signoff,
    customer_state,
    location_code: customer_state,
  };
  if (p.total_system_cost != null) rec.gross_account_value = p.total_system_cost;
  if (p.installer?.trim()) rec.install_partner = p.installer.trim();
  if (p.net_epc != null) rec.net_epc = p.net_epc;
  if (remit?.gross_ppw != null) rec.epc = remit.gross_ppw;
  if (remit?.adder_amount != null) rec.adders = remit.adder_amount;
  if (remit?.finance_fee != null) rec.dealer_fee_amount = remit.finance_fee;

  const jobStatus = resolveJobStatus(p, remit, isNew);
  if (jobStatus) rec.job_status = jobStatus;

  const closer1Id = parseSequifiEmployeeId(p.closer_sequifi_employee_id);
  if (closer1Id != null) rec.closer1_id = closer1Id;

  const setter1Id = parseSequifiEmployeeId(p.setter_sequifi_employee_id);
  if (setter1Id != null) rec.setter1_id = setter1Id;

  return rec;
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
  // Hub/remittance wins: only seed net_epc from Sequifi when creating sparse pull rows.
  if (sale.net_epc != null) row.net_epc = sale.net_epc;
  return row;
}

export async function syncWithSequifi({
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

    // ── Plan the push (Supabase -> Sequifi) ──────────────────────────────────
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
        const rec = buildUpsertRecord(p, pid, false, remittanceByProject.get(p.id) ?? null);
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
          ? buildUpsertRecord(p, pid, true, remittanceByProject.get(p.id) ?? null)
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

    // ── Plan the pull (Sequifi-only -> Supabase) ─────────────────────────────
    const pushedPids = new Set(pushApply.map((x) => x.pid));
    const pullInserts: Record<string, unknown>[] = [];
    for (const sale of sales) {
      if (pushedPids.has(sale.pid)) continue;
      const n = normalizeName(sale.customer_name);
      if (n && projectNames.has(n)) continue; // would duplicate an existing project
      pullInserts.push(buildProjectFromSale(sale));
      if (result.samples.pull.length < 10) {
        result.samples.pull.push(`${sale.pid} (${sale.customer_name})`);
      }
    }

    // ── Dry run: report the plan, write nothing ──────────────────────────────
    if (dryRun) {
      result.pushedUpdate = pushApply.filter((x) => !x.isNew).length;
      result.pushedNew = pushApply.filter((x) => x.isNew).length;
      result.pulledNew = pullInserts.length;
      return result;
    }

    // ── Apply: push to Sequifi ───────────────────────────────────────────────
    if (pushRecords.length) {
      const outcome = await upsertSequifiSales(pushRecords);
      result.errors += outcome.errors.length;
      for (const e of outcome.errors) {
        if (result.errorMessages.length < 15) {
          result.errorMessages.push(`push ${e.pid}: ${e.message}`);
        }
      }

      for (const item of pushApply) {
        if (!outcome.succeededPids.has(item.pid)) continue;
        const { error: updErr } = await db
          .from("projects")
          .update({
            sequifi_sale_id: item.pid,
            sequifi_job_status: item.sequifi_job_status,
            sequifi_synced_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (updErr) {
          result.errors++;
          if (result.errorMessages.length < 15) {
            result.errorMessages.push(`link ${item.id}: ${updErr.message}`);
          }
          continue;
        }
        if (item.isNew) result.pushedNew++;
        else result.pushedUpdate++;
      }
    }

    // ── Apply: pull Sequifi-only sales into Supabase ─────────────────────────
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

    revalidatePath("/projects");
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sequifi sync failed." };
  }
}
