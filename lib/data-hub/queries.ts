import { createServerSupabase } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import {
  parseProjectSort,
} from "@/lib/data-hub/project-sort";
import {
  ALL_COLUMN_FILTER_DEFS,
  applyProjectColumnFilter,
  applySalesRepFilter,
  applySalesRepMultiSelectFilter,
  applySetterMultiSelectFilter,
  isColumnFilterActive,
  projectIdsMatchingRemittanceFilters,
  type ColumnFilterMap,
  type MultiSelectColumnFilterMap,
  type ParsedColumnFilters,
} from "@/lib/data-hub/column-filters";

export type Project = {
  id: string;
  project_id: string;
  opportunity_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state_code: string | null;
  postal_code: string | null;
  project_stage: string | null;
  contract_signed_date: string | null;
  total_system_cost: number | null;
  system_size_kw: number | null;
  sales_advisor_name: string | null;
  sales_advisor_email: string | null;
  setter_name: string | null;
  setter_email: string | null;
  closer_name: string | null;
  closer_email: string | null;
  market: string | null;
  team: string | null;
  region: string | null;
  division: string | null;
  dealer_name: string | null;
  office_name: string | null;
  installer: string | null;
  terros_account_id: string | null;
  sequifi_sale_id: string | null;
  net_epc: number | null;
  updated_at: string;
};

// Financial fields promoted from the latest remittance row for a project.
export type RemittanceSummary = {
  payment_date: string | null;
  status: string | null;
  payment_status: string | null;
  sales_partner: string | null;
  channel: string | null;
  latest_contract: string | null;
  contract_date: string | null;
  finance_type: string | null;
  financier: string | null;
  utility_provider: string | null;
  pv_size: number | null;
  redline_price_tier: number | null;
  contract_amount: number | null;
  gross_ppw: number | null;
  finance_fee: number | null;
  cash_deal_value: number | null;
  battery_price: number | null;
  adder_amount: number | null;
  contract_adder_detail: string | null;
  post_sale_adder_work_order: number | null;
  post_sale_adders: number | null;
  pv_only_price: number | null;
  ppw: number | null;
  down_payment: number | null;
  spif: number | null;
  tpo_rebate: number | null;
  etqa: number | null;
  enfin_dca: number | null;
  light_reach_dca: number | null;
  partner_commission: number | null;
  partner_incentive: number | null;
  re_payment: number | null;
  c0: number | null;
  c1: number | null;
  c2: number | null;
  adjusted_c2: number | null;
  c0_paid: number | null;
  c1_paid: number | null;
  c2_paid: number | null;
  incentive_paid: number | null;
  clawback: number | null;
  others: number | null;
  total_sp_paid: number | null;
  payment_this_week: number | null;
};

export type ProjectWithRemittance = Project & {
  remittance: RemittanceSummary | null;
};

export type ProjectFilterValues = {
  setters: string[];
  salesReps: string[];
  statuses: string[];
};

const REMITTANCE_MERGE_COLUMNS =
  "project_id, payment_date, status, payment_status, sales_partner, channel, latest_contract, contract_date, finance_type, financier, utility_provider, pv_size, redline_price_tier, contract_amount, gross_ppw, finance_fee, cash_deal_value, battery_price, adder_amount, contract_adder_detail, post_sale_adder_work_order, post_sale_adders, pv_only_price, ppw, down_payment, spif, tpo_rebate, etqa, enfin_dca, light_reach_dca, partner_commission, partner_incentive, re_payment, c0, c1, c2, adjusted_c2, c0_paid, c1_paid, c2_paid, incentive_paid, clawback, others, total_sp_paid, payment_this_week";

// Attaches the latest remittance row (by payment_date) to each project.
async function attachRemittance(
  db: ReturnType<typeof createServerSupabase>,
  rows: Project[]
): Promise<ProjectWithRemittance[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const { data: rpcData, error: rpcError } = await db.rpc(
    "latest_remittance_for_projects",
    { project_ids: ids }
  );

  if (!rpcError && rpcData) {
    const byProject = new Map<string, RemittanceSummary>();
    for (const raw of (rpcData ?? []) as Record<string, unknown>[]) {
      const pid = raw.project_id as string | null;
      if (pid && !byProject.has(pid)) {
        const { project_id: _ignored, id: _id, ...summary } = raw;
        byProject.set(pid, summary as RemittanceSummary);
      }
    }
    return rows.map((r) => ({ ...r, remittance: byProject.get(r.id) ?? null }));
  }

  const { data, error } = await db
    .from("remittance")
    .select(REMITTANCE_MERGE_COLUMNS)
    .in("project_id", ids)
    .order("payment_date", { ascending: false });

  if (error) {
    return rows.map((r) => ({ ...r, remittance: null }));
  }

  const byProject = new Map<string, RemittanceSummary>();
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const pid = raw.project_id as string | null;
    if (pid && !byProject.has(pid)) {
      const { project_id: _ignored, ...summary } = raw;
      byProject.set(pid, summary as RemittanceSummary);
    }
  }

  return rows.map((r) => ({ ...r, remittance: byProject.get(r.id) ?? null }));
}

export async function listProjects(limit = 100, search?: string): Promise<Project[]> {
  const db = createServerSupabase();
  let query = db
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(
      `project_id.ilike.%${search}%,opportunity_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("projects")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Project[];
}

export async function listProjectsPaged(opts: {
  page: number;
  pageSize: number;
  search?: string;
  installer?: string;
  setter?: string;
  salesRep?: string;
  status?: string;
  columnFilters?: ParsedColumnFilters;
  sort?: string;
  sortDir?: string;
  userEmail?: string;
}): Promise<{ rows: ProjectWithRemittance[]; total: number }> {
  const db = createServerSupabase();
  const page = Math.max(1, opts.page);
  const from = (page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;
  const { column, ascending } = parseProjectSort(opts.sort, opts.sortDir);
  const columnFilters = opts.columnFilters ?? { advanced: {}, multiSelect: {} };
  const { advanced, multiSelect } = columnFilters;

  const remittanceProjectIds = await projectIdsMatchingRemittanceFilters(
    db,
    advanced,
    ALL_COLUMN_FILTER_DEFS
  );

  if (remittanceProjectIds && remittanceProjectIds.size === 0) {
    return { rows: [], total: 0 };
  }

  const applyFilters = <Q extends { eq: Function; or: Function; ilike: Function; in: Function }>(
    query: Q
  ): Q => {
    let q = query;

    if (remittanceProjectIds) {
      q = q.in("id", [...remittanceProjectIds]) as Q;
    }

    if (opts.userEmail) {
      q = q.or(
        `setter_email.ilike.${opts.userEmail},closer_email.ilike.${opts.userEmail},sales_advisor_email.ilike.${opts.userEmail}`
      ) as Q;
    }

    if (opts.search) {
      q = q.or(
        `project_id.ilike.%${opts.search}%,opportunity_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`
      ) as Q;
    }

    if (opts.installer?.trim() && !advanced.installer) {
      q = q.eq("installer", opts.installer.trim()) as Q;
    }
    if (opts.setter?.trim() && !multiSelect.setter_name?.length && !advanced.setter_name) {
      q = q.ilike("setter_name", `%${opts.setter.trim()}%`) as Q;
    }
    if (
      opts.salesRep?.trim() &&
      !multiSelect.sales_rep?.length &&
      !advanced.sales_rep
    ) {
      const value = opts.salesRep.trim();
      q = q.or(
        `closer_name.ilike.%${value}%,sales_advisor_name.ilike.%${value}%,setter_name.ilike.%${value}%`
      ) as Q;
    }
    if (opts.status?.trim() && !advanced.project_stage) {
      q = q.ilike("project_stage", `%${opts.status.trim()}%`) as Q;
    }

    if (multiSelect.setter_name?.length) {
      q = applySetterMultiSelectFilter(q as never, multiSelect.setter_name) as Q;
    }
    if (multiSelect.sales_rep?.length) {
      q = applySalesRepMultiSelectFilter(q as never, multiSelect.sales_rep) as Q;
    }

    for (const def of ALL_COLUMN_FILTER_DEFS) {
      if (def.id === "setter_name" && multiSelect.setter_name?.length) continue;
      if (def.id === "sales_rep" && multiSelect.sales_rep?.length) continue;
      const filter = advanced[def.id];
      if (!filter || !isColumnFilterActive(filter)) continue;
      if (def.source === "projects" && def.dbColumn) {
        q = applyProjectColumnFilter(q as never, def.dbColumn, filter) as Q;
      } else if (def.source === "sales_rep") {
        q = applySalesRepFilter(q as never, filter) as Q;
      }
    }

    return q;
  };

  const dataQuery = applyFilters(
    db
      .from("projects")
      .select("*")
      .order(column, { ascending })
      .range(from, to)
  );

  const countQuery = applyFilters(
    db.from("projects").select("id", { count: "exact", head: true })
  );

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    dataQuery,
    countQuery,
  ]);

  if (error) {
    if (error.message.includes("projects")) return { rows: [], total: 0 };
    throw new Error(error.message);
  }
  if (countError) {
    if (countError.message.includes("projects")) return { rows: [], total: 0 };
    throw new Error(countError.message);
  }

  const rows = await attachRemittance(db, (data ?? []) as Project[]);
  return { rows, total: count ?? 0 };
}

async function fetchProjectFilterValues(): Promise<ProjectFilterValues> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("projects")
    .select("setter_name, closer_name, sales_advisor_name, project_stage");

  if (error) {
    if (error.message.includes("projects")) {
      return { setters: [], salesReps: [], statuses: [] };
    }
    throw new Error(error.message);
  }

  const setters = new Set<string>();
  const salesReps = new Set<string>();
  const statuses = new Set<string>();

  for (const row of data ?? []) {
    const setter = row.setter_name ? String(row.setter_name).trim() : "";
    const closer = row.closer_name ? String(row.closer_name).trim() : "";
    const advisor = row.sales_advisor_name ? String(row.sales_advisor_name).trim() : "";
    const stage = row.project_stage ? String(row.project_stage).trim() : "";

    if (setter) setters.add(setter);
    if (closer) salesReps.add(closer);
    if (advisor) salesReps.add(advisor);
    if (!closer && !advisor && setter) salesReps.add(setter);
    if (stage) statuses.add(stage);
  }

  return {
    setters: [...setters].sort((a, b) => a.localeCompare(b)),
    salesReps: [...salesReps].sort((a, b) => a.localeCompare(b)),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
  };
}

/** Filter dropdown options change rarely — avoid re-scanning all projects on every sort/filter. */
export const listProjectFilterValues = unstable_cache(
  fetchProjectFilterValues,
  ["project-filter-values"],
  { revalidate: 300 }
);

export async function getProject(id: string) {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listRemittance(limit = 500, search?: string) {
  const db = createServerSupabase();
  let query = db
    .from("remittance")
    .select("*")
    .order("payment_date", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(
      `hes_code.ilike.%${search}%,customer_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("remittance")) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function listImportHistory(limit = 50) {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("hub_import_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("hub_import_log")) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function countProjects() {
  const db = createServerSupabase();
  const { count, error } = await db
    .from("projects")
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}
