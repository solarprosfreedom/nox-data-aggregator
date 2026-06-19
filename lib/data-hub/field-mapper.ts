export const SKIP = "__skip__";

export const PROJECT_FIELDS = [
  { key: "project_id",             label: "Project ID / HES ID",       required: true },
  { key: "opportunity_name",       label: "Customer Name / Opportunity" },
  { key: "first_name",             label: "First Name" },
  { key: "last_name",              label: "Last Name" },
  { key: "email",                  label: "Email" },
  { key: "phone",                  label: "Phone" },
  { key: "address_line1",          label: "Street Address" },
  { key: "city",                   label: "City" },
  { key: "state_code",             label: "State" },
  { key: "postal_code",            label: "Zip Code" },
  { key: "project_stage",          label: "Project Stage / Status" },
  { key: "contract_signed_date",   label: "Contract Date" },
  { key: "total_system_cost",      label: "Total System Cost ($)" },
  { key: "system_size_kw",         label: "System Size (kW)" },
  { key: "sales_advisor_name",     label: "Sales Advisor Name" },
  { key: "sales_advisor_email",    label: "Sales Advisor Email" },
  { key: "setter_name",            label: "Setter Name" },
  { key: "setter_email",           label: "Setter Email" },
  { key: "closer_name",            label: "Closer Name" },
  { key: "closer_email",           label: "Closer Email" },
  { key: "market",                 label: "Market" },
  { key: "team",                   label: "Team" },
  { key: "region",                 label: "Region" },
  { key: "division",               label: "Division" },
  { key: "dealer_name",            label: "Dealer Name" },
  { key: "office_name",            label: "Office Name" },
  { key: "installer",              label: "Installer / Dealer" },
] as const;

export const REMITTANCE_FIELDS = [
  { key: "hes_code",                    label: "HES Code / Project ID",        required: true },
  { key: "payment_date",                label: "Payment Date",                 required: true },
  { key: "customer_name",               label: "Customer Name" },
  { key: "sales_partner",               label: "Sales Partner" },
  { key: "sales_advisor",               label: "Sales Advisor" },
  { key: "channel",                     label: "Channel" },
  { key: "status",                      label: "Status" },
  { key: "latest_contract",             label: "Latest Contract" },
  { key: "contract_date",               label: "Contract Date" },
  { key: "finance_type",                label: "Finance Type" },
  { key: "financier",                   label: "Financier" },
  { key: "utility_provider",            label: "Utility Provider" },
  { key: "pv_size",                     label: "PV Size (kW)" },
  { key: "redline_price_tier",          label: "Redline Price Tier" },
  { key: "contract_amount",             label: "Contract Amount ($)" },
  { key: "gross_ppw",                   label: "Gross PPW" },
  { key: "finance_fee",                 label: "Finance Fee ($)" },
  { key: "cash_deal_value",             label: "Cash Deal Value ($)" },
  { key: "battery_price",               label: "Battery Price ($)" },
  { key: "adder_amount",                label: "Adder Amount ($)" },
  { key: "contract_adder_detail",       label: "Contract Adder Detail" },
  { key: "post_sale_adder_work_order",  label: "Post Sale Adder (Work Order)" },
  { key: "post_sale_adders",            label: "Post Sale Adders ($)" },
  { key: "pv_only_price",               label: "PV Only Price ($)" },
  { key: "ppw",                         label: "PPW" },
  { key: "down_payment",                label: "Down Payment ($)" },
  { key: "spif",                        label: "SPIF ($)" },
  { key: "tpo_rebate",                  label: "TPO Rebate ($)" },
  { key: "etqa",                        label: "ETQA ($)" },
  { key: "enfin_dca",                   label: "Enfin DCA ($)" },
  { key: "light_reach_dca",             label: "Light Reach DCA ($)" },
  { key: "partner_commission",          label: "Partner Commission ($)" },
  { key: "partner_incentive",           label: "Partner Incentive ($)" },
  { key: "re_payment",                  label: "Re-Payment ($)" },
  { key: "c0",                          label: "C0 ($)" },
  { key: "c1",                          label: "C1 ($)" },
  { key: "c2",                          label: "C2 ($)" },
  { key: "adjusted_c2",                 label: "Adjusted C2 ($)" },
  { key: "c0_paid",                     label: "C0 Paid ($)" },
  { key: "c1_paid",                     label: "C1 Paid ($)" },
  { key: "c2_paid",                     label: "C2 Paid ($)" },
  { key: "incentive_paid",              label: "Incentive Paid ($)" },
  { key: "clawback",                    label: "Clawback ($)" },
  { key: "others",                      label: "Others ($)" },
  { key: "total_sp_paid",               label: "Total SP Paid ($)" },
  { key: "payment_this_week",           label: "Payment This Week ($)" },
] as const;

export type SchemaType = "projects" | "remittance";
export type FieldDef = { key: string; label: string; required?: boolean };

export function getFields(schema: SchemaType): readonly FieldDef[] {
  return schema === "remittance" ? REMITTANCE_FIELDS : PROJECT_FIELDS;
}

const NUMERIC_REMITTANCE_KEYS = new Set([
  "pv_size","redline_price_tier","contract_amount","gross_ppw","finance_fee",
  "cash_deal_value","battery_price","adder_amount","post_sale_adder_work_order",
  "post_sale_adders","pv_only_price","ppw","down_payment","spif","tpo_rebate",
  "etqa","enfin_dca","light_reach_dca","partner_commission","partner_incentive",
  "re_payment","c0","c1","c2","adjusted_c2","c0_paid","c1_paid","c2_paid",
  "incentive_paid","clawback","others","total_sp_paid","payment_this_week",
]);

/** Keywords that strongly suggest each project field */
const PROJECT_KEYWORDS: Record<string, string[]> = {
  project_id:           ["hes id", "hes code", "hes_id", "project id", "our#", "our number", "pid"],
  opportunity_name:     ["customer name", "full name", "lead name", "opportunity name", "opportunity"],
  first_name:           ["first name"],
  last_name:            ["last name"],
  email:                ["email address", "email"],
  phone:                ["primary phone number", "phone number", "phone", "mobile", "cell"],
  address_line1:        ["street address", "address line 1", "address"],
  city:                 ["city"],
  state_code:           ["state code", "state"],
  postal_code:          ["zip code", "postal code", "zip", "postal"],
  project_stage:        ["project stage", "pipeline stage", "job status", "stage", "status"],
  contract_signed_date: ["original contract signed date", "contract signed date", "contract date", "sale date"],
  total_system_cost:    ["total system cost", "sow amount", "gross account value", "contract amount", "total cost"],
  system_size_kw:       ["system size (kw)", "system size", "pv size", "kw"],
  sales_advisor_name:   ["sales advisor: full name", "sales advisor full name", "sales advisor name", "sales advisor", "advisor"],
  sales_advisor_email:  ["sales advisor: email", "sales advisor email", "advisor email"],
  setter_name:          ["setter name", "setter", "set by", "setter 1"],
  setter_email:         ["setter email"],
  closer_name:          ["closer name", "closer 1", "closer"],
  closer_email:         ["closer email"],
  market:               ["market"],
  team:                 ["team"],
  region:               ["region"],
  division:             ["division"],
  dealer_name:          ["dealer name", "dealer", "installer"],
  office_name:          ["office name", "office"],
  installer:            ["installer", "dealer name", "dealer", "sales partner", "partner name"],
};

const REMITTANCE_KEYWORDS: Record<string, string[]> = {
  hes_code:                   ["hes code", "hes id", "hes_id", "project id", "pid"],
  payment_date:               ["payment date"],
  customer_name:              ["customer name", "customer"],
  sales_partner:              ["sales partner", "partner"],
  sales_advisor:              ["sales advisor"],
  channel:                    ["channel"],
  status:                     ["status"],
  latest_contract:            ["latest contract"],
  contract_date:              ["contract date"],
  finance_type:               ["finance type"],
  financier:                  ["financier"],
  utility_provider:           ["utility provider", "utility"],
  pv_size:                    ["pv size", "system size", "kw"],
  redline_price_tier:         ["redline price", "redline"],
  contract_amount:            ["contract amount"],
  gross_ppw:                  ["gross ppw"],
  finance_fee:                ["finance fee"],
  cash_deal_value:            ["cash deal value"],
  battery_price:              ["battery price", "battery"],
  adder_amount:               ["adder amount", "adder"],
  contract_adder_detail:      ["contract adder detail"],
  post_sale_adder_work_order: ["post sale adder from work order", "post sale adder work order"],
  post_sale_adders:           ["post sale adders"],
  pv_only_price:              ["pv only price"],
  ppw:                        ["ppw"],
  down_payment:               ["down payment"],
  spif:                       ["spif"],
  tpo_rebate:                 ["tpo rebate"],
  etqa:                       ["etqa"],
  enfin_dca:                  ["enfin dca", "enfin"],
  light_reach_dca:            ["light reach dca", "light reach"],
  partner_commission:         ["partner commission", "partner's commission"],
  partner_incentive:          ["partner incentive", "partner's incentive"],
  re_payment:                 ["re-payment", "repayment"],
  c0:                         ["c0"],
  c1:                         ["c1"],
  c2:                         ["c2"],
  adjusted_c2:                ["adjusted c2"],
  c0_paid:                    ["c0 paid"],
  c1_paid:                    ["c1 paid"],
  c2_paid:                    ["c2 paid"],
  incentive_paid:             ["incentive paid"],
  clawback:                   ["clawback"],
  others:                     ["others"],
  total_sp_paid:              ["total sp paid"],
  payment_this_week:          ["payment this week"],
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
    // Only do substring match if both strings are long enough to avoid false positives
    if (h.length >= 3 && kw.length >= 3) {
      if (h.includes(kw)) return 70 - i;
      if (kw.includes(h)) return 50 - i;
    }
  }
  return 0;
}

export function autoSuggestMapping(
  csvHeaders: string[],
  schema: SchemaType
): Record<string, string> {
  const keywordMap = schema === "remittance" ? REMITTANCE_KEYWORDS : PROJECT_KEYWORDS;
  const fields = getFields(schema);
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    let bestField = SKIP;
    let bestScore = 0;

    for (const { key } of fields) {
      if (usedFields.has(key)) continue;
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

export function applyMapping(
  row: Record<string, string>,
  mapping: Record<string, string>,
  schema: SchemaType
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const numericFields =
    schema === "remittance"
      ? NUMERIC_REMITTANCE_KEYS
      : new Set(["total_system_cost", "system_size_kw"]);
  const dateFields =
    schema === "remittance"
      ? new Set(["payment_date", "contract_date"])
      : new Set(["contract_signed_date"]);

  for (const [csvCol, fieldKey] of Object.entries(mapping)) {
    if (fieldKey === SKIP || fieldKey === "") continue;
    const raw = (row[csvCol] ?? "").trim();
    if (!raw) continue;

    if (numericFields.has(fieldKey)) {
      const n = parseFloat(raw.replace(/[$,]/g, ""));
      if (!isNaN(n)) result[fieldKey] = n;
    } else if (dateFields.has(fieldKey)) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) result[fieldKey] = d.toISOString().slice(0, 10);
    } else {
      result[fieldKey] = raw;
    }
  }

  return result;
}
