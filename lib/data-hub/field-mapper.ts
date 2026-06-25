export const SKIP = "__skip__";

export type SchemaType = "projects" | "remittance";
export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  group?: string;
};

/** All mappable fields in projects table column order (excludes computed PPW columns). */
export const TABLE_MAPPER_FIELDS: readonly FieldDef[] = [
  { key: "project_id", label: "Project ID", required: true },
  { key: "opportunity_name", label: "Customer" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state_code", label: "State" },
  { key: "postal_code", label: "Zip" },
  { key: "project_stage", label: "Stage" },
  { key: "status", label: "Remit Status (Stage)" },
  { key: "contract_signed_date", label: "Contract Date" },
  { key: "system_size_kw", label: "System Size (kW)" },
  { key: "system_size_watts", label: "System Size (W)" },
  { key: "total_system_cost", label: "Total Cost" },
  { key: "setter_name", label: "Setter" },
  { key: "closer_name", label: "Sales Rep" },
  { key: "installer", label: "Installer" },
  { key: "payment_date", label: "Pmt Date" },
  { key: "finance_type", label: "Finance Type" },
  { key: "financier", label: "Financier" },
  { key: "utility_provider", label: "Utility" },
  { key: "pv_size", label: "PV Size" },
  { key: "pv_size_watts", label: "PV Size (W)" },
  { key: "redline_price_tier", label: "Redline Tier" },
  { key: "contract_amount", label: "Contract Amt" },
  { key: "gross_ppw", label: "Gross PPW" },
  { key: "ppw", label: "PPW" },
  { key: "finance_fee", label: "Finance Fee" },
  { key: "cash_deal_value", label: "Cash Deal" },
  { key: "battery_price", label: "Battery" },
  { key: "adder_amount", label: "Adder Amt" },
  { key: "contract_adder_detail", label: "Adder Detail" },
  { key: "post_sale_adder_work_order", label: "Post-Sale WO" },
  { key: "post_sale_adders", label: "Post-Sale Adders" },
  { key: "pv_only_price", label: "PV Only Price" },
  { key: "down_payment", label: "Down Pmt" },
  { key: "spif", label: "SPIF" },
  { key: "tpo_rebate", label: "TPO Rebate" },
  { key: "etqa", label: "ETQA" },
  { key: "enfin_dca", label: "Enfin DCA" },
  { key: "light_reach_dca", label: "Light Reach DCA" },
  { key: "partner_commission", label: "Partner Comm" },
  { key: "partner_incentive", label: "Partner Incentive" },
  { key: "re_payment", label: "Re-Payment" },
  { key: "c0", label: "C0" },
  { key: "c1", label: "C1" },
  { key: "c2", label: "C2" },
  { key: "adjusted_c2", label: "Adj C2" },
  { key: "c0_paid", label: "C0 Paid" },
  { key: "c1_paid", label: "C1 Paid" },
  { key: "c2_paid", label: "C2 Paid" },
  { key: "incentive_paid", label: "Incentive Paid" },
  { key: "clawback", label: "Clawback" },
  { key: "others", label: "Others" },
  { key: "total_sp_paid", label: "Total SP Paid" },
  { key: "payment_status", label: "Payment Status" },
];

const REMITTANCE_TABLE_KEYS = new Set([
  "status",
  "payment_date",
  "finance_type",
  "financier",
  "utility_provider",
  "pv_size",
  "pv_size_watts",
  "redline_price_tier",
  "contract_amount",
  "gross_ppw",
  "ppw",
  "finance_fee",
  "cash_deal_value",
  "battery_price",
  "adder_amount",
  "contract_adder_detail",
  "post_sale_adder_work_order",
  "post_sale_adders",
  "pv_only_price",
  "down_payment",
  "spif",
  "tpo_rebate",
  "etqa",
  "enfin_dca",
  "light_reach_dca",
  "partner_commission",
  "partner_incentive",
  "re_payment",
  "c0",
  "c1",
  "c2",
  "adjusted_c2",
  "c0_paid",
  "c1_paid",
  "c2_paid",
  "incentive_paid",
  "clawback",
  "others",
  "total_sp_paid",
  "payment_status",
]);

/** @deprecated Use TABLE_MAPPER_FIELDS — project keys only, table order preserved. */
export const PROJECT_FIELDS: readonly FieldDef[] = TABLE_MAPPER_FIELDS.filter(
  (f) => !REMITTANCE_TABLE_KEYS.has(f.key),
);

/** @deprecated Use TABLE_MAPPER_FIELDS — remittance keys only, table order preserved. */
export const REMITTANCE_FIELDS: readonly FieldDef[] = TABLE_MAPPER_FIELDS.filter((f) =>
  REMITTANCE_TABLE_KEYS.has(f.key),
);

/** Legacy remittance-only import (hes_code maps to project_id in unified flow). */
export const REMITTANCE_LEGACY_FIELDS: readonly FieldDef[] = [
  { key: "hes_code", label: "HES Code / Project ID", required: true, group: "Identity" },
  ...REMITTANCE_FIELDS.map((f) =>
    f.key === "payment_date" ? { ...f, group: "Identity" } : f,
  ),
];

export const PROJECT_FIELD_KEYS = new Set(
  TABLE_MAPPER_FIELDS.map((f) => f.key).filter((k) => !REMITTANCE_TABLE_KEYS.has(k)),
);
export const REMITTANCE_FIELD_KEYS = REMITTANCE_TABLE_KEYS;

/** Single mapper: project + remittance fields in table column order. */
export const UNIFIED_FIELDS: readonly FieldDef[] = TABLE_MAPPER_FIELDS;

/** Only one field per group may be mapped (e.g. kW vs W for system size). */
const EXCLUSIVE_FIELD_GROUPS: string[][] = [
  ["system_size_kw", "system_size_watts"],
  ["pv_size", "pv_size_watts"],
];

export function getFields(schema: SchemaType): readonly FieldDef[] {
  if (schema === "remittance") return REMITTANCE_LEGACY_FIELDS;
  return UNIFIED_FIELDS;
}

export function getRequiredFieldKeys(schema: SchemaType): string[] {
  if (schema === "remittance") {
    return REMITTANCE_LEGACY_FIELDS.filter((f) => f.required).map((f) => f.key);
  }
  return ["project_id"];
}

export function normalizeTemplateColumnMap(
  columnMap: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, fieldKey] of Object.entries(columnMap)) {
    out[header] = fieldKey === "hes_code" ? "project_id" : fieldKey;
  }
  return out;
}

export function splitMappedPatch(patch: Record<string, unknown>): {
  project: Record<string, unknown>;
  remittance: Record<string, unknown>;
} {
  const project: Record<string, unknown> = {};
  const remittance: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "updated_at") continue;
    if (REMITTANCE_FIELD_KEYS.has(key)) remittance[key] = value;
    else if (PROJECT_FIELD_KEYS.has(key)) project[key] = value;
  }
  return { project, remittance };
}

export function hasRemittancePatch(remittance: Record<string, unknown>): boolean {
  return Object.keys(remittance).length > 0;
}

export function getFieldGroups(schema: SchemaType): { label: string; fields: FieldDef[] }[] {
  const fields = getFields(schema);
  return [{ label: "Table columns", fields: [...fields] }];
}

export function isFieldMappingBlocked(
  fieldKey: string,
  mappedKeys: Set<string>,
  currentSelection: string
): boolean {
  if (fieldKey === currentSelection) return false;
  if (mappedKeys.has(fieldKey)) return true;

  for (const group of EXCLUSIVE_FIELD_GROUPS) {
    if (!group.includes(fieldKey)) continue;
    for (const peer of group) {
      if (peer !== fieldKey && mappedKeys.has(peer)) return true;
    }
  }
  return false;
}

const NUMERIC_REMITTANCE_KEYS = new Set([
  "pv_size", "redline_price_tier", "contract_amount", "gross_ppw", "finance_fee",
  "cash_deal_value", "battery_price", "adder_amount", "post_sale_adder_work_order",
  "post_sale_adders", "pv_only_price", "ppw", "down_payment", "spif", "tpo_rebate",
  "etqa", "enfin_dca", "light_reach_dca", "partner_commission", "partner_incentive",
  "re_payment", "c0", "c1", "c2", "adjusted_c2", "c0_paid", "c1_paid", "c2_paid",
  "incentive_paid", "clawback", "others", "total_sp_paid", "payment_this_week",
]);

const PROJECT_KEYWORDS: Record<string, string[]> = {
  project_id: ["hes id", "hes code", "hes_id", "project id", "our#", "our number", "pid"],
  opportunity_name: ["customer name", "full name", "lead name", "opportunity name", "opportunity"],
  first_name: ["first name"],
  last_name: ["last name"],
  email: ["email address", "email"],
  phone: ["primary phone number", "phone number", "phone", "mobile", "cell"],
  address_line1: ["street address", "address line 1", "address"],
  city: ["city"],
  state_code: ["state code", "state"],
  postal_code: ["zip code", "postal code", "zip", "postal"],
  project_stage: ["project stage", "pipeline stage", "job status", "stage"],
  contract_signed_date: ["original contract signed date", "contract signed date", "contract date", "sale date"],
  total_system_cost: ["total system cost", "total contract price", "sow amount", "gross account value", "total cost"],
  system_size_kw: ["system size kw", "system size (kw)", "system size", "pv size kw", "size kw"],
  system_size_watts: ["system size w", "system size (w)", "system size watts", "pv size w", "size watts", "watts"],
  sales_advisor_name: ["sales advisor: full name", "sales advisor full name", "sales advisor name", "sales advisor", "advisor"],
  setter_name: ["setter name", "setter", "set by", "setter 1"],
  closer_name: ["sales rep", "sales rep name", "closer name", "closer 1", "closer", "rep name"],
  installer: ["installer", "dealer name", "dealer", "sales partner", "partner name", "inty"],
};

const REMITTANCE_KEYWORDS: Record<string, string[]> = {
  hes_code: ["hes code", "hes id", "hes_id", "project id", "pid"],
  payment_date: ["payment date", "pay date", "week ending"],
  customer_name: ["customer name", "customer"],
  sales_partner: ["sales partner", "partner", "installer", "inty"],
  sales_advisor: ["sales advisor"],
  channel: ["channel"],
  status: ["remit status", "remittance status", "install status", "job status"],
  payment_status: ["payment status", "milestone status", "m1 m2 m3"],
  latest_contract: ["latest contract"],
  contract_date: ["contract date"],
  finance_type: ["finance type"],
  financier: ["financier"],
  utility_provider: ["utility provider", "utility"],
  pv_size: ["pv size kw", "pv size (kw)", "system size kw"],
  pv_size_watts: ["pv size w", "pv size (w)", "system size w", "system size watts", "watts"],
  redline_price_tier: ["redline price", "redline"],
  contract_amount: ["total contract price", "contract amount", "gross contract"],
  gross_ppw: ["gross ppw"],
  ppw: ["net ppw", "ppw"],
  finance_fee: ["finance fee", "dealer fee"],
  cash_deal_value: ["net contract price", "net contract", "cash deal value", "cash deal"],
  battery_price: ["battery price", "battery"],
  adder_amount: ["adder amount", "adder", "adders"],
  contract_adder_detail: ["contract adder detail", "adder detail"],
  post_sale_adder_work_order: ["post sale adder from work order", "post sale adder work order"],
  post_sale_adders: ["post sale adders"],
  pv_only_price: ["pv only price"],
  down_payment: ["down payment"],
  spif: ["spif"],
  tpo_rebate: ["tpo rebate"],
  etqa: ["etqa"],
  enfin_dca: ["enfin dca", "enfin"],
  light_reach_dca: ["light reach dca", "light reach"],
  partner_commission: ["partner commission", "partner's commission"],
  partner_incentive: ["partner incentive", "partner's incentive"],
  re_payment: ["re-payment", "repayment"],
  c0: ["m1 amount", "m1", "c0"],
  c1: ["m2 amount", "m2", "c1"],
  c2: ["m3 amount", "m3", "c2"],
  adjusted_c2: ["adjusted c2", "adjusted m3"],
  c0_paid: ["m1 paid", "c0 paid"],
  c1_paid: ["m2 paid", "c1 paid"],
  c2_paid: ["m3 paid", "c2 paid"],
  incentive_paid: ["incentive paid"],
  clawback: ["clawback"],
  others: ["others"],
  total_sp_paid: ["total sp paid"],
  payment_this_week: ["payment this week"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function score(csvHeader: string, fieldKey: string, keywordMap: Record<string, string[]>): number {
  const h = normalize(csvHeader);
  if (!h) return 0;
  const keywords = keywordMap[fieldKey] ?? [];
  for (let i = 0; i < keywords.length; i++) {
    const kw = normalize(keywords[i]!);
    if (h === kw) return 100 - i;
    if (h.length >= 3 && kw.length >= 3) {
      if (h.includes(kw)) return 70 - i;
      if (kw.includes(h)) return 50 - i;
    }
  }
  return 0;
}

function parseNumeric(raw: string): number | null {
  const n = parseFloat(raw.replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

const NUMERIC_PROJECT_KEYS = new Set(["total_system_cost", "system_size_kw"]);

function keywordMapForSchema(schema: SchemaType): Record<string, string[]> {
  if (schema === "remittance") return REMITTANCE_KEYWORDS;
  const merged: Record<string, string[]> = {
    ...REMITTANCE_KEYWORDS,
    ...PROJECT_KEYWORDS,
  };
  merged.project_id = [
    ...(PROJECT_KEYWORDS.project_id ?? []),
    ...(REMITTANCE_KEYWORDS.hes_code ?? []),
  ];
  delete merged.hes_code;
  return merged;
}

export function autoSuggestMapping(
  csvHeaders: string[],
  schema: SchemaType
): Record<string, string> {
  const keywordMap = keywordMapForSchema(schema);
  const fields = getFields(schema);
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    let bestField = SKIP;
    let bestScore = 0;

    for (const { key } of fields) {
      if (isFieldMappingBlocked(key, usedFields, "")) continue;
      const s = score(header, key, keywordMap);
      if (s > bestScore) {
        bestScore = s;
        bestField = key;
      }
    }

    if (bestScore > 0) usedFields.add(bestField);
    mapping[header] = bestField;
  }

  return mapping;
}

function assignNumeric(
  result: Record<string, unknown>,
  targetKey: string,
  value: number
) {
  result[targetKey] = value;
}

export function applyMapping(
  row: Record<string, string>,
  mapping: Record<string, string>,
  schema: SchemaType
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const numericFields =
    schema === "remittance"
      ? NUMERIC_REMITTANCE_KEYS
      : new Set([...NUMERIC_PROJECT_KEYS, ...NUMERIC_REMITTANCE_KEYS]);
  const dateFields =
    schema === "remittance"
      ? new Set(["payment_date"])
      : new Set(["contract_signed_date", "payment_date"]);

  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    if (fieldKey === SKIP || fieldKey === "") continue;
    const raw = (row[csvCol] ?? "").trim();
    if (!raw) continue;

    if (fieldKey === "system_size_watts") {
      const n = parseNumeric(raw);
      if (n != null) assignNumeric(result, "system_size_kw", n / 1000);
      continue;
    }

    if (fieldKey === "pv_size_watts") {
      const n = parseNumeric(raw);
      if (n != null) assignNumeric(result, "pv_size", n / 1000);
      continue;
    }

    if (numericFields.has(fieldKey)) {
      const n = parseNumeric(raw);
      if (n != null) result[fieldKey] = n;
    } else if (dateFields.has(fieldKey)) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) result[fieldKey] = d.toISOString().slice(0, 10);
    } else {
      result[fieldKey] = raw;
    }
  }

  return result;
}
