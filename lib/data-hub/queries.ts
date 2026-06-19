import { createServerSupabase } from "@/lib/supabase/server";

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
  updated_at: string;
};

// Financial fields promoted from the latest remittance row for a project.
export type RemittanceSummary = {
  payment_date: string | null;
  status: string | null;
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

const REMITTANCE_MERGE_COLUMNS =
  "project_id, payment_date, status, sales_partner, channel, latest_contract, contract_date, finance_type, financier, utility_provider, pv_size, redline_price_tier, contract_amount, gross_ppw, finance_fee, cash_deal_value, battery_price, adder_amount, contract_adder_detail, post_sale_adder_work_order, post_sale_adders, pv_only_price, ppw, down_payment, spif, tpo_rebate, etqa, enfin_dca, light_reach_dca, partner_commission, partner_incentive, re_payment, c0, c1, c2, adjusted_c2, c0_paid, c1_paid, c2_paid, incentive_paid, clawback, others, total_sp_paid, payment_this_week";

// Attaches the latest remittance row (by payment_date) to each project.
async function attachRemittance(
  db: ReturnType<typeof createServerSupabase>,
  rows: Project[]
): Promise<ProjectWithRemittance[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const { data, error } = await db
    .from("remittance")
    .select(REMITTANCE_MERGE_COLUMNS)
    .in("project_id", ids)
    .order("payment_date", { ascending: false });

  if (error) {
    // remittance table may be absent; degrade gracefully.
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
  userEmail?: string; // when set, filters to projects where setter_email or closer_email matches
}): Promise<{ rows: ProjectWithRemittance[]; total: number }> {
  const db = createServerSupabase();
  const page = Math.max(1, opts.page);
  const from = (page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  let query = db
    .from("projects")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  // Non-admin users only see their own projects (setter or closer).
  if (opts.userEmail) {
    query = query.or(
      `setter_email.ilike.${opts.userEmail},closer_email.ilike.${opts.userEmail},sales_advisor_email.ilike.${opts.userEmail}`
    );
  }

  if (opts.search) {
    query = query.or(
      `project_id.ilike.%${opts.search}%,opportunity_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    if (error.message.includes("projects")) return { rows: [], total: 0 };
    throw new Error(error.message);
  }

  const rows = await attachRemittance(db, (data ?? []) as Project[]);
  return { rows, total: count ?? 0 };
}

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
