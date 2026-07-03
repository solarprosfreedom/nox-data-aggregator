import { createServerSupabase } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import {
  parseProjectSort,
} from "@/lib/data-hub/project-sort";
import {
  ALL_COLUMN_FILTER_DEFS,
  columnDefById,
  isColumnFilterActive,
  matchesColumnFilter,
  type ParsedColumnFilters,
} from "@/lib/data-hub/column-filters";
import { listAllPublicDeals, type PublicDealRow } from "@/lib/public-deals/client";

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
  id: string | null;
  payment_date: string | null;
  customer_name: string | null;
  status: string | null;
  payment_status: string | null;
  sales_partner: string | null;
  sales_advisor: string | null;
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
  imported_at: string | null;
};

export type ProjectWithRemittance = Project & {
  remittance: RemittanceSummary | null;
};

export type ProjectFilterValues = {
  setters: string[];
  salesReps: string[];
  statuses: string[];
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapPublicDealRow(row: PublicDealRow): ProjectWithRemittance {
  const p = row.project ?? {};
  const r = row.remittance ?? {};
  const projectId = strOrNull(p.project_id) ?? row.pk_value;
  const updatedAt =
    strOrNull(p.updated_at) ??
    strOrNull(row.raw?.updated_at) ??
    strOrNull(r.imported_at) ??
    new Date(0).toISOString();

  return {
    id: projectId,
    project_id: projectId,
    opportunity_name: strOrNull(p.opportunity_name),
    first_name: strOrNull(p.first_name),
    last_name: strOrNull(p.last_name),
    email: strOrNull(p.email),
    phone: strOrNull(p.phone),
    address_line1: strOrNull(p.address_line1),
    city: strOrNull(p.city),
    state_code: strOrNull(p.state_code),
    postal_code: strOrNull(p.postal_code),
    project_stage: strOrNull(p.project_stage),
    contract_signed_date: strOrNull(p.contract_signed_date),
    total_system_cost: numOrNull(p.total_system_cost),
    system_size_kw: numOrNull(p.system_size_kw),
    sales_advisor_name: strOrNull(p.sales_advisor_name),
    sales_advisor_email: strOrNull(p.sales_advisor_email),
    setter_name: strOrNull(p.setter_name),
    setter_email: strOrNull(p.setter_email),
    closer_name: strOrNull(p.closer_name),
    closer_email: strOrNull(p.closer_email),
    market: strOrNull(p.market),
    team: strOrNull(p.team),
    region: strOrNull(p.region),
    division: strOrNull(p.division),
    dealer_name: strOrNull(p.dealer_name),
    office_name: strOrNull(p.office_name),
    installer: strOrNull(p.installer) ?? row.installer,
    terros_account_id: strOrNull(p.terros_account_id),
    sequifi_sale_id: strOrNull(p.sequifi_sale_id),
    net_epc: numOrNull(p.net_epc),
    updated_at: updatedAt,
    remittance: {
      id: strOrNull(r.id),
      payment_date: strOrNull(r.payment_date),
      customer_name: strOrNull(r.customer_name),
      status: strOrNull(r.status),
      payment_status: strOrNull(r.payment_status),
      sales_partner: strOrNull(r.sales_partner),
      sales_advisor: strOrNull(r.sales_advisor),
      channel: strOrNull(r.channel),
      latest_contract: strOrNull(r.latest_contract),
      contract_date: strOrNull(r.contract_date),
      finance_type: strOrNull(r.finance_type),
      financier: strOrNull(r.financier),
      utility_provider: strOrNull(r.utility_provider),
      pv_size: numOrNull(r.pv_size),
      redline_price_tier: numOrNull(r.redline_price_tier),
      contract_amount: numOrNull(r.contract_amount),
      gross_ppw: numOrNull(r.gross_ppw),
      finance_fee: numOrNull(r.finance_fee),
      cash_deal_value: numOrNull(r.cash_deal_value),
      battery_price: numOrNull(r.battery_price),
      adder_amount: numOrNull(r.adder_amount),
      contract_adder_detail: strOrNull(r.contract_adder_detail),
      post_sale_adder_work_order: numOrNull(r.post_sale_adder_work_order),
      post_sale_adders: numOrNull(r.post_sale_adders),
      pv_only_price: numOrNull(r.pv_only_price),
      ppw: numOrNull(r.ppw),
      down_payment: numOrNull(r.down_payment),
      spif: numOrNull(r.spif),
      tpo_rebate: numOrNull(r.tpo_rebate),
      etqa: numOrNull(r.etqa),
      enfin_dca: numOrNull(r.enfin_dca),
      light_reach_dca: numOrNull(r.light_reach_dca),
      partner_commission: numOrNull(r.partner_commission),
      partner_incentive: numOrNull(r.partner_incentive),
      re_payment: numOrNull(r.re_payment),
      c0: numOrNull(r.c0),
      c1: numOrNull(r.c1),
      c2: numOrNull(r.c2),
      adjusted_c2: numOrNull(r.adjusted_c2),
      c0_paid: numOrNull(r.c0_paid),
      c1_paid: numOrNull(r.c1_paid),
      c2_paid: numOrNull(r.c2_paid),
      incentive_paid: numOrNull(r.incentive_paid),
      clawback: numOrNull(r.clawback),
      others: numOrNull(r.others),
      total_sp_paid: numOrNull(r.total_sp_paid),
      payment_this_week: numOrNull(r.payment_this_week),
      imported_at: strOrNull(r.imported_at),
    },
  };
}

async function listEndpointProjects(): Promise<ProjectWithRemittance[]> {
  const rows = await listAllPublicDeals();
  return rows.map(mapPublicDealRow);
}

const REMITTANCE_MERGE_COLUMNS =
  "id, project_id, payment_date, customer_name, status, payment_status, sales_partner, sales_advisor, channel, latest_contract, contract_date, finance_type, financier, utility_provider, pv_size, redline_price_tier, contract_amount, gross_ppw, finance_fee, cash_deal_value, battery_price, adder_amount, contract_adder_detail, post_sale_adder_work_order, post_sale_adders, pv_only_price, ppw, down_payment, spif, tpo_rebate, etqa, enfin_dca, light_reach_dca, partner_commission, partner_incentive, re_payment, c0, c1, c2, adjusted_c2, c0_paid, c1_paid, c2_paid, incentive_paid, clawback, others, total_sp_paid, payment_this_week, imported_at";

// Attaches the latest remittance row (by imported_at) to each project.
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
        const { project_id: _ignored, ...summary } = raw;
        byProject.set(pid, summary as RemittanceSummary);
      }
    }
    return rows.map((r) => ({ ...r, remittance: byProject.get(r.id) ?? null }));
  }

  const { data, error } = await db
    .from("remittance")
    .select(REMITTANCE_MERGE_COLUMNS)
    .in("project_id", ids)
    .order("imported_at", { ascending: false });

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
  const page = Math.max(1, opts.page);
  const { column, ascending } = parseProjectSort(opts.sort, opts.sortDir);
  const columnFilters = opts.columnFilters ?? { advanced: {}, multiSelect: {} };
  const { advanced, multiSelect } = columnFilters;
  let rows = await listEndpointProjects();

  const contains = (value: unknown, needle: string) =>
    String(value ?? "").toLowerCase().includes(needle.toLowerCase());
  const salesRepValue = (row: ProjectWithRemittance) =>
    row.closer_name || row.sales_advisor_name || row.setter_name || "";
  const cellValue = (row: ProjectWithRemittance, id: string) => {
    if (id === "sales_rep") return salesRepValue(row);
    const def = columnDefById(id);
    if (def?.source === "remittance") return row.remittance?.[id as keyof RemittanceSummary];
    return row[id as keyof ProjectWithRemittance];
  };

  if (opts.userEmail) {
    rows = rows.filter((row) =>
      [row.setter_email, row.closer_email, row.sales_advisor_email].some((v) =>
        contains(v, opts.userEmail!),
      ),
    );
  }

  if (opts.search?.trim()) {
    const q = opts.search.trim();
    rows = rows.filter((row) =>
      [row.project_id, row.opportunity_name, row.email, row.phone].some((v) =>
        contains(v, q),
      ),
    );
  }

  if (opts.installer?.trim() && !advanced.installer) {
    rows = rows.filter((row) => row.installer === opts.installer!.trim());
  }
  if (opts.setter?.trim() && !multiSelect.setter_name?.length && !advanced.setter_name) {
    rows = rows.filter((row) => contains(row.setter_name, opts.setter!.trim()));
  }
  if (opts.salesRep?.trim() && !multiSelect.sales_rep?.length && !advanced.sales_rep) {
    rows = rows.filter((row) => contains(salesRepValue(row), opts.salesRep!.trim()));
  }
  if (opts.status?.trim() && !advanced.project_stage) {
    rows = rows.filter((row) => contains(row.project_stage, opts.status!.trim()));
  }

  if (multiSelect.setter_name?.length) {
    rows = rows.filter((row) => multiSelect.setter_name!.includes(row.setter_name ?? ""));
  }
  if (multiSelect.sales_rep?.length) {
    rows = rows.filter((row) => multiSelect.sales_rep!.includes(salesRepValue(row)));
  }

  for (const [id, filter] of Object.entries(advanced)) {
    if (!isColumnFilterActive(filter)) continue;
    if (id === "setter_name" && multiSelect.setter_name?.length) continue;
    if (id === "sales_rep" && multiSelect.sales_rep?.length) continue;
    const def = columnDefById(id);
    if (!def) continue;
    rows = rows.filter((row) =>
      matchesColumnFilter(cellValue(row, id), filter, def.kind),
    );
  }

  rows = rows.sort((a, b) => {
    const av = a[column as keyof ProjectWithRemittance];
    const bv = b[column as keyof ProjectWithRemittance];
    const an = typeof av === "number" ? av : Number.NaN;
    const bn = typeof bv === "number" ? bv : Number.NaN;
    let cmp: number;
    if (!Number.isNaN(an) && !Number.isNaN(bn)) cmp = an - bn;
    else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    return ascending ? cmp : -cmp;
  });

  const total = rows.length;
  const from = (page - 1) * opts.pageSize;
  return { rows: rows.slice(from, from + opts.pageSize), total };
}

async function fetchProjectFilterValues(): Promise<ProjectFilterValues> {
  const data = await listEndpointProjects();

  const setters = new Set<string>();
  const salesReps = new Set<string>();
  const statuses = new Set<string>();

  for (const row of data) {
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
  const rows = await listEndpointProjects();
  return rows.find((row) => row.id === id || row.project_id === id) ?? null;
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
