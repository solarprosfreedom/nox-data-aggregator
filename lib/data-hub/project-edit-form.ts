import type { RemittanceSummary } from "@/lib/data-hub/queries";
import { TABLE_MAPPER_FIELDS, REMITTANCE_FIELD_KEYS } from "@/lib/data-hub/field-mapper";

export type ProjectEditField = {
  key: string;
  label: string;
  type?: "text" | "date" | "number";
  section: "project" | "remittance";
};

const NUMERIC_PROJECT_KEYS = new Set(["total_system_cost", "system_size_kw"]);
const NUMERIC_REMITTANCE_KEYS = new Set([
  "pv_size",
  "redline_price_tier",
  "contract_amount",
  "gross_ppw",
  "ppw",
  "finance_fee",
  "cash_deal_value",
  "battery_price",
  "adder_amount",
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
]);

const SKIP_EDIT_KEYS = new Set(["project_id", "system_size_watts", "pv_size_watts"]);

function fieldType(key: string, section: "project" | "remittance"): ProjectEditField["type"] {
  if (key === "contract_signed_date" || key === "payment_date") return "date";
  if (section === "project" && NUMERIC_PROJECT_KEYS.has(key)) return "number";
  if (section === "remittance" && NUMERIC_REMITTANCE_KEYS.has(key)) return "number";
  return undefined;
}

export const PROJECT_EDIT_FIELDS: ProjectEditField[] = TABLE_MAPPER_FIELDS.filter(
  (f) => !REMITTANCE_FIELD_KEYS.has(f.key) && !SKIP_EDIT_KEYS.has(f.key),
).map((f) => ({
  key: f.key,
  label: f.label,
  section: "project" as const,
  type: fieldType(f.key, "project"),
}));

export const REMITTANCE_EDIT_FIELDS: ProjectEditField[] = TABLE_MAPPER_FIELDS.filter(
  (f) => REMITTANCE_FIELD_KEYS.has(f.key) && !SKIP_EDIT_KEYS.has(f.key),
).map((f) => ({
  key: f.key,
  label: f.label,
  section: "remittance" as const,
  type: fieldType(f.key, "remittance"),
}));

export type ProjectFormData = Record<string, string> & {
  remittance_id: string;
};

const REMITTANCE_KEYS = REMITTANCE_EDIT_FIELDS.map((f) => f.key);

export function remittanceFormHasValues(form: ProjectFormData): boolean {
  return REMITTANCE_KEYS.some((key) => form[key]?.trim());
}

export function buildRemittanceUpdatePayload(form: ProjectFormData): Record<string, string | number | null> {
  const textKeys = REMITTANCE_EDIT_FIELDS.filter((f) => f.type !== "number").map((f) => f.key);
  const numKeys = REMITTANCE_EDIT_FIELDS.filter((f) => f.type === "number").map((f) => f.key);
  const out: Record<string, string | number | null> = {};

  for (const key of textKeys) {
    if (key === "payment_date") continue;
    const v = form[key]?.trim();
    out[key] = v || null;
  }

  for (const key of numKeys) {
    const raw = form[key]?.trim();
    if (!raw) {
      out[key] = null;
      continue;
    }
    const n = parseFloat(raw.replace(/[$,]/g, ""));
    out[key] = Number.isFinite(n) ? n : null;
  }

  return out;
}

export function initProjectForm(
  project: Record<string, unknown>,
  remittance: RemittanceSummary | null,
): ProjectFormData {
  const form: Record<string, string> = {
    remittance_id: remittance?.id != null ? String(remittance.id) : "",
  };

  for (const { key } of PROJECT_EDIT_FIELDS) {
    form[key] = project[key] == null ? "" : String(project[key]);
  }

  for (const { key } of REMITTANCE_EDIT_FIELDS) {
    const v = remittance?.[key as keyof RemittanceSummary];
    form[key] = v == null ? "" : String(v);
  }

  return form as ProjectFormData;
}
