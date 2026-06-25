export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "isempty"
  | "isnotempty";

export type ColumnFilterCondition = {
  op: FilterOperator;
  value: string;
};

export type ColumnFilterState = {
  c1: ColumnFilterCondition;
  logic: "and" | "or";
  c2?: ColumnFilterCondition;
};

export type ColumnFilterMap = Record<string, ColumnFilterState>;

export type MultiSelectColumnFilterMap = Record<string, string[]>;

export type ParsedColumnFilters = {
  advanced: ColumnFilterMap;
  multiSelect: MultiSelectColumnFilterMap;
};

const MULTISELECT_PREFIX = "in:";

export type ColumnFilterKind = "text" | "number" | "date";

export type ColumnFilterDef = {
  id: string;
  label: string;
  kind: ColumnFilterKind;
  /** Supabase table: projects or remittance (latest row per project). */
  source: "projects" | "remittance" | "sales_rep";
  dbColumn?: string;
};

export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "eq", label: "Is equal to" },
  { value: "neq", label: "Is not equal to" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "isempty", label: "Is empty" },
  { value: "isnotempty", label: "Is not empty" },
];

const CF_PREFIX = "cf_";

function encodeCondition(c: ColumnFilterCondition): string {
  if (c.op === "isempty" || c.op === "isnotempty") return c.op;
  return `${c.op}:${encodeURIComponent(c.value)}`;
}

function decodeCondition(raw: string): ColumnFilterCondition | null {
  const trimmed = raw.trim();
  if (trimmed === "isempty" || trimmed === "isnotempty") {
    return { op: trimmed, value: "" };
  }
  const idx = trimmed.indexOf(":");
  if (idx <= 0) return null;
  const op = trimmed.slice(0, idx) as FilterOperator;
  if (!FILTER_OPERATORS.some((o) => o.value === op)) return null;
  return { op, value: decodeURIComponent(trimmed.slice(idx + 1)) };
}

/** URL value: `contains:foo~and~eq:bar` or single `eq:bar` */
export function encodeColumnFilter(state: ColumnFilterState): string {
  const parts = [encodeCondition(state.c1)];
  if (state.c2?.op) {
    parts.push(state.logic, encodeCondition(state.c2));
  }
  return parts.join("~");
}

export function decodeColumnFilter(raw: string): ColumnFilterState | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const segments = trimmed.split("~");
  const c1 = decodeCondition(segments[0] ?? "");
  if (!c1) return null;
  if (segments.length === 1) {
    return { c1, logic: "and" };
  }
  const logic = segments[1] === "or" ? "or" : "and";
  const c2 = decodeCondition(segments[2] ?? "");
  if (!c2) return { c1, logic: "and" };
  return { c1, logic, c2 };
}

export function encodeMultiSelectFilter(values: string[]): string {
  return `${MULTISELECT_PREFIX}${values.map((v) => encodeURIComponent(v)).join("|")}`;
}

export function decodeMultiSelectFilter(raw: string): string[] | null {
  if (!raw.startsWith(MULTISELECT_PREFIX)) return null;
  const body = raw.slice(MULTISELECT_PREFIX.length);
  if (!body) return null;
  return body
    .split("|")
    .map((part) => decodeURIComponent(part))
    .filter(Boolean);
}

export function parseColumnFilters(
  params: Record<string, string | string[] | undefined>
): ParsedColumnFilters {
  const advanced: ColumnFilterMap = {};
  const multiSelect: MultiSelectColumnFilterMap = {};
  for (const [key, raw] of Object.entries(params)) {
    if (!key.startsWith(CF_PREFIX)) continue;
    const columnId = key.slice(CF_PREFIX.length);
    if (!columnId) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) continue;
    const multi = decodeMultiSelectFilter(value);
    if (multi && multi.length > 0) {
      multiSelect[columnId] = multi;
      continue;
    }
    const decoded = decodeColumnFilter(value);
    if (decoded) advanced[columnId] = decoded;
  }
  return { advanced, multiSelect };
}

export function columnFilterParamKey(columnId: string): string {
  return `${CF_PREFIX}${columnId}`;
}

export function isColumnFilterActive(state: ColumnFilterState | undefined): boolean {
  if (!state) return false;
  if (state.c1.op === "isempty" || state.c1.op === "isnotempty") return true;
  if (state.c1.value.trim()) return true;
  if (state.c2?.op === "isempty" || state.c2?.op === "isnotempty") return true;
  if (state.c2?.value.trim()) return true;
  return false;
}

/** Legacy URL params → column filter map (backward compatible). */
export function legacyParamsToColumnFilters(params: {
  setter?: string;
  salesRep?: string;
  status?: string;
  installer?: string;
}): ParsedColumnFilters {
  const advanced: ColumnFilterMap = {};
  const multiSelect: MultiSelectColumnFilterMap = {};

  if (params.setter?.trim()) {
    multiSelect.setter_name = [params.setter.trim()];
  }
  if (params.salesRep?.trim()) {
    multiSelect.sales_rep = [params.salesRep.trim()];
  }
  if (params.status?.trim()) {
    advanced.project_stage = {
      c1: { op: "contains", value: params.status.trim() },
      logic: "and",
    };
  }
  if (params.installer?.trim()) {
    advanced.installer = {
      c1: { op: "eq", value: params.installer.trim() },
      logic: "and",
    };
  }
  return { advanced, multiSelect };
}

export function mergeColumnFilters(
  fromUrl: ParsedColumnFilters,
  legacy: ParsedColumnFilters
): ParsedColumnFilters {
  return {
    advanced: { ...legacy.advanced, ...fromUrl.advanced },
    multiSelect: { ...legacy.multiSelect, ...fromUrl.multiSelect },
  };
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function matchesCondition(
  cell: unknown,
  condition: ColumnFilterCondition,
  kind: ColumnFilterKind
): boolean {
  const raw = cell == null ? "" : String(cell);
  const value = condition.value;
  const empty = raw.trim() === "";

  switch (condition.op) {
    case "isempty":
      return empty;
    case "isnotempty":
      return !empty;
    case "eq":
      if (kind === "number") {
        const n = Number(raw);
        const v = Number(value);
        return !isNaN(n) && !isNaN(v) && n === v;
      }
      return raw.toLowerCase() === value.toLowerCase();
    case "neq":
      if (kind === "number") {
        const n = Number(raw);
        const v = Number(value);
        return !isNaN(n) && !isNaN(v) && n !== v;
      }
      return raw.toLowerCase() !== value.toLowerCase();
    case "contains":
      return raw.toLowerCase().includes(value.toLowerCase());
    case "not_contains":
      return !raw.toLowerCase().includes(value.toLowerCase());
    case "starts_with":
      return raw.toLowerCase().startsWith(value.toLowerCase());
    case "ends_with":
      return raw.toLowerCase().endsWith(value.toLowerCase());
    default:
      return true;
  }
}

function matchesFilter(
  cell: unknown,
  filter: ColumnFilterState,
  kind: ColumnFilterKind
): boolean {
  const m1 = matchesCondition(cell, filter.c1, kind);
  if (!filter.c2 || (!filter.c2.value && filter.c2.op !== "isempty" && filter.c2.op !== "isnotempty")) {
    return m1;
  }
  const m2 = matchesCondition(cell, filter.c2, kind);
  return filter.logic === "or" ? m1 || m2 : m1 && m2;
}

export function applyProjectColumnFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  column: string,
  filter: ColumnFilterState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const applyOne = (q: typeof query, cond: ColumnFilterCondition) => {
    switch (cond.op) {
      case "eq":
        return q.eq(column, cond.value);
      case "neq":
        return q.neq(column, cond.value);
      case "contains":
        return q.ilike(column, `%${escapeIlike(cond.value)}%`);
      case "not_contains":
        return q.not(column, "ilike", `%${escapeIlike(cond.value)}%`);
      case "starts_with":
        return q.ilike(column, `${escapeIlike(cond.value)}%`);
      case "ends_with":
        return q.ilike(column, `%${escapeIlike(cond.value)}`);
      case "isempty":
        return q.or(`${column}.is.null,${column}.eq.`);
      case "isnotempty":
        return q.not(column, "is", null).not(column, "eq", "");
      default:
        return q;
    }
  };

  const hasC2 =
    filter.c2 &&
    (filter.c2.op === "isempty" ||
      filter.c2.op === "isnotempty" ||
      filter.c2.value.trim());

  if (!hasC2) return applyOne(query, filter.c1);

  if (filter.logic === "and") {
    return applyOne(applyOne(query, filter.c1), filter.c2!);
  }

  const orParts: string[] = [];
  for (const cond of [filter.c1, filter.c2!]) {
    switch (cond.op) {
      case "eq":
        orParts.push(`${column}.eq.${cond.value}`);
        break;
      case "contains":
        orParts.push(`${column}.ilike.%${escapeIlike(cond.value)}%`);
        break;
      case "starts_with":
        orParts.push(`${column}.ilike.${escapeIlike(cond.value)}%`);
        break;
      case "ends_with":
        orParts.push(`${column}.ilike.%${escapeIlike(cond.value)}`);
        break;
      case "isempty":
        orParts.push(`${column}.is.null`, `${column}.eq.`);
        break;
      case "isnotempty":
        return applyOne(query, filter.c1);
      default:
        break;
    }
  }
  if (orParts.length > 0) {
    return query.or(orParts.join(","));
  }
  return applyOne(query, filter.c1);
}

export function applySalesRepFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filter: ColumnFilterState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const buildOr = (cond: ColumnFilterCondition): string | null => {
    if (cond.op === "isempty") {
      return "and(closer_name.is.null,closer_name.eq.),and(sales_advisor_name.is.null,sales_advisor_name.eq.),and(setter_name.is.null,setter_name.eq.)";
    }
    if (cond.op === "isnotempty") {
      return "closer_name.not.is.null,sales_advisor_name.not.is.null,setter_name.not.is.null";
    }
    if (!cond.value.trim()) return null;
    const v = escapeIlike(cond.value);
    const pattern =
      cond.op === "eq"
        ? cond.value
        : cond.op === "starts_with"
          ? `${v}%`
          : cond.op === "ends_with"
            ? `%${v}`
            : `%${v}%`;
    const op = cond.op === "eq" ? "eq" : "ilike";
    return [
      `closer_name.${op}.${pattern}`,
      `sales_advisor_name.${op}.${pattern}`,
      `setter_name.${op}.${pattern}`,
    ].join(",");
  };

  const or1 = buildOr(filter.c1);
  if (!or1) return query;
  return query.or(or1);
}

export function applySetterMultiSelectFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  names: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (names.length === 0) return query;
  return query.in("setter_name", names);
}

export function applySalesRepMultiSelectFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  names: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (names.length === 0) return query;
  const orParts = names.flatMap((name) => [
    `closer_name.eq.${name}`,
    `sales_advisor_name.eq.${name}`,
    `setter_name.eq.${name}`,
  ]);
  return query.or(orParts.join(","));
}

export async function projectIdsMatchingRemittanceFilters(
  db: ReturnType<typeof import("@/lib/supabase/server").createServerSupabase>,
  filters: ColumnFilterMap,
  defs: ColumnFilterDef[]
): Promise<Set<string> | null> {
  const remittanceFilters = defs.filter(
    (d) => d.source === "remittance" && filters[d.id] && isColumnFilterActive(filters[d.id])
  );
  if (remittanceFilters.length === 0) return null;

  const columns = [
    "project_id",
    "payment_date",
    ...remittanceFilters.map((d) => d.dbColumn!).filter(Boolean),
  ];
  const uniqueCols = [...new Set(columns)];

  const latest = new Map<string, Record<string, unknown>>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("remittance")
      .select(uniqueCols.join(", "))
      .not("project_id", "is", null)
      .order("payment_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) {
      const pid = row.project_id as string;
      if (pid && !latest.has(pid)) latest.set(pid, row);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const matching = new Set<string>();
  for (const [projectId, row] of latest) {
    let ok = true;
    for (const def of remittanceFilters) {
      const cell = row[def.dbColumn!];
      if (!matchesFilter(cell, filters[def.id]!, def.kind)) {
        ok = false;
        break;
      }
    }
    if (ok) matching.add(projectId);
  }
  return matching;
}

export const PROJECT_TABLE_COLUMN_DEFS: ColumnFilterDef[] = [
  { id: "project_id", label: "Project ID", kind: "text", source: "projects", dbColumn: "project_id" },
  { id: "opportunity_name", label: "Customer", kind: "text", source: "projects", dbColumn: "opportunity_name" },
  { id: "email", label: "Email", kind: "text", source: "projects", dbColumn: "email" },
  { id: "phone", label: "Phone", kind: "text", source: "projects", dbColumn: "phone" },
  { id: "address_line1", label: "Address", kind: "text", source: "projects", dbColumn: "address_line1" },
  { id: "city", label: "City", kind: "text", source: "projects", dbColumn: "city" },
  { id: "state_code", label: "State", kind: "text", source: "projects", dbColumn: "state_code" },
  { id: "postal_code", label: "Zip", kind: "text", source: "projects", dbColumn: "postal_code" },
  { id: "project_stage", label: "Stage", kind: "text", source: "projects", dbColumn: "project_stage" },
  { id: "contract_signed_date", label: "Contract Date", kind: "date", source: "projects", dbColumn: "contract_signed_date" },
  { id: "system_size_kw", label: "System Size", kind: "number", source: "projects", dbColumn: "system_size_kw" },
  { id: "total_system_cost", label: "Total Cost", kind: "number", source: "projects", dbColumn: "total_system_cost" },
  { id: "setter_name", label: "Setter", kind: "text", source: "projects", dbColumn: "setter_name" },
  { id: "sales_rep", label: "Sales Rep", kind: "text", source: "sales_rep" },
  { id: "installer", label: "Installer", kind: "text", source: "projects", dbColumn: "installer" },
];

export const REMITTANCE_COLUMN_DEFS: ColumnFilterDef[] = [
  { id: "payment_date", label: "Pmt Date", kind: "date", source: "remittance", dbColumn: "payment_date" },
  { id: "finance_type", label: "Finance Type", kind: "text", source: "remittance", dbColumn: "finance_type" },
  { id: "financier", label: "Financier", kind: "text", source: "remittance", dbColumn: "financier" },
  { id: "utility_provider", label: "Utility", kind: "text", source: "remittance", dbColumn: "utility_provider" },
  { id: "pv_size", label: "PV Size", kind: "number", source: "remittance", dbColumn: "pv_size" },
  { id: "redline_price_tier", label: "Redline Tier", kind: "number", source: "remittance", dbColumn: "redline_price_tier" },
  { id: "contract_amount", label: "Contract Amt", kind: "number", source: "remittance", dbColumn: "contract_amount" },
  { id: "gross_ppw", label: "Gross PPW", kind: "number", source: "remittance", dbColumn: "gross_ppw" },
  { id: "ppw", label: "PPW", kind: "number", source: "remittance", dbColumn: "ppw" },
  { id: "finance_fee", label: "Finance Fee", kind: "number", source: "remittance", dbColumn: "finance_fee" },
  { id: "cash_deal_value", label: "Cash Deal", kind: "number", source: "remittance", dbColumn: "cash_deal_value" },
  { id: "battery_price", label: "Battery", kind: "number", source: "remittance", dbColumn: "battery_price" },
  { id: "adder_amount", label: "Adder Amt", kind: "number", source: "remittance", dbColumn: "adder_amount" },
  { id: "contract_adder_detail", label: "Adder Detail", kind: "text", source: "remittance", dbColumn: "contract_adder_detail" },
  { id: "post_sale_adder_work_order", label: "Post-Sale WO", kind: "number", source: "remittance", dbColumn: "post_sale_adder_work_order" },
  { id: "post_sale_adders", label: "Post-Sale Adders", kind: "number", source: "remittance", dbColumn: "post_sale_adders" },
  { id: "pv_only_price", label: "PV Only Price", kind: "number", source: "remittance", dbColumn: "pv_only_price" },
  { id: "down_payment", label: "Down Pmt", kind: "number", source: "remittance", dbColumn: "down_payment" },
  { id: "spif", label: "SPIF", kind: "number", source: "remittance", dbColumn: "spif" },
  { id: "tpo_rebate", label: "TPO Rebate", kind: "number", source: "remittance", dbColumn: "tpo_rebate" },
  { id: "etqa", label: "ETQA", kind: "number", source: "remittance", dbColumn: "etqa" },
  { id: "enfin_dca", label: "Enfin DCA", kind: "number", source: "remittance", dbColumn: "enfin_dca" },
  { id: "light_reach_dca", label: "Light Reach DCA", kind: "number", source: "remittance", dbColumn: "light_reach_dca" },
  { id: "partner_commission", label: "Partner Comm", kind: "number", source: "remittance", dbColumn: "partner_commission" },
  { id: "partner_incentive", label: "Partner Incentive", kind: "number", source: "remittance", dbColumn: "partner_incentive" },
  { id: "re_payment", label: "Re-Payment", kind: "number", source: "remittance", dbColumn: "re_payment" },
  { id: "c0", label: "C0", kind: "number", source: "remittance", dbColumn: "c0" },
  { id: "c1", label: "C1", kind: "number", source: "remittance", dbColumn: "c1" },
  { id: "c2", label: "C2", kind: "number", source: "remittance", dbColumn: "c2" },
  { id: "adjusted_c2", label: "Adj C2", kind: "number", source: "remittance", dbColumn: "adjusted_c2" },
  { id: "c0_paid", label: "C0 Paid", kind: "number", source: "remittance", dbColumn: "c0_paid" },
  { id: "c1_paid", label: "C1 Paid", kind: "number", source: "remittance", dbColumn: "c1_paid" },
  { id: "c2_paid", label: "C2 Paid", kind: "number", source: "remittance", dbColumn: "c2_paid" },
  { id: "incentive_paid", label: "Incentive Paid", kind: "number", source: "remittance", dbColumn: "incentive_paid" },
  { id: "clawback", label: "Clawback", kind: "number", source: "remittance", dbColumn: "clawback" },
  { id: "others", label: "Others", kind: "number", source: "remittance", dbColumn: "others" },
  { id: "total_sp_paid", label: "Total SP Paid", kind: "number", source: "remittance", dbColumn: "total_sp_paid" },
  { id: "payment_status", label: "Payment Status", kind: "text", source: "remittance", dbColumn: "payment_status" },
  { id: "status", label: "Remit Status", kind: "text", source: "remittance", dbColumn: "status" },
];

export const ALL_COLUMN_FILTER_DEFS = [
  ...PROJECT_TABLE_COLUMN_DEFS,
  ...REMITTANCE_COLUMN_DEFS,
];

export function columnDefById(id: string): ColumnFilterDef | undefined {
  return ALL_COLUMN_FILTER_DEFS.find((d) => d.id === id);
}
