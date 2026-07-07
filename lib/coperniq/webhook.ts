import { createServerSupabase } from "@/lib/supabase/server";

type JsonObject = Record<string, unknown>;

export type CoperniqWebhookRow = {
  event_id: string | null;
  record_id: string | null;
  record_uid: string | null;
  record_type: string | null;
  trigger_key: string | null;
  trigger_name: string | null;
  fired_at: string | null;
  work_order_id: string | null;
  project_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  postal_code: string | null;
  system_size_kw: number | null;
  contract_signed_date: string | null;
  total_system_cost: number | null;
  project_stage: string | null;
  install_date: string | null;
  setter_name: string | null;
  setter_email: string | null;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
  gross_ppw: number | null;
  net_ppw: number | null;
  adders: number | null;
  finance_type: string | null;
  raw_body: string;
  raw_payload: unknown;
  request_headers?: Record<string, string>;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw || null;
}

function lowerEmail(value: unknown): string | null {
  return text(value)?.toLowerCase() ?? null;
}

function numberValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const raw = String(value).replace(/[$,\s]/g, "").replace(/kw$/i, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function cleanKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getPath(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split(".")) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function findByPaths(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = getPath(source, path);
    if (value != null && value !== "") return value;
  }
  return undefined;
}

function findLoose(source: unknown, aliases: string[]): unknown {
  const targets = new Set(aliases.map(cleanKey));
  const seen = new Set<unknown>();

  function visit(value: unknown): unknown {
    if (!isObject(value) && !Array.isArray(value)) return undefined;
    if (seen.has(value)) return undefined;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found != null && found !== "") return found;
      }
      return undefined;
    }

    for (const [key, child] of Object.entries(value)) {
      if (targets.has(cleanKey(key)) && child != null && child !== "") return child;
    }
    for (const child of Object.values(value)) {
      const found = visit(child);
      if (found != null && found !== "") return found;
    }
    return undefined;
  }

  return visit(source);
}

function pickText(source: unknown, paths: string[], aliases: string[] = paths): string | null {
  return text(findByPaths(source, paths) ?? findLoose(source, aliases));
}

function pickEmail(source: unknown, paths: string[], aliases: string[] = paths): string | null {
  return lowerEmail(findByPaths(source, paths) ?? findLoose(source, aliases));
}

function pickNumber(source: unknown, paths: string[], aliases: string[] = paths): number | null {
  return numberValue(findByPaths(source, paths) ?? findLoose(source, aliases));
}

function pickDate(source: unknown, paths: string[], aliases: string[] = paths): string | null {
  return dateValue(findByPaths(source, paths) ?? findLoose(source, aliases));
}

function stageName(value: unknown): string | null {
  if (isObject(value)) return text(value.name) ?? text(value.title) ?? text(value.id);
  return text(value);
}

function splitName(value: string | null): { firstName: string | null; lastName: string | null } {
  const raw = value?.trim();
  if (!raw) return { firstName: null, lastName: null };
  const parts = raw.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function customerName(payload: unknown): string | null {
  const explicit = pickText(payload, [
    "record.primaryContact.name",
    "record.customer.name",
    "record.account.name",
    "record.contact.name",
    "record.customerName",
    "record.homeownerName",
    "customer.name",
    "customerName",
  ]);
  if (explicit) return explicit;

  const first = pickText(payload, [
    "record.primaryContact.firstName",
    "record.customer.firstName",
    "record.contact.firstName",
    "customer.firstName",
    "firstName",
  ]);
  const last = pickText(payload, [
    "record.primaryContact.lastName",
    "record.customer.lastName",
    "record.contact.lastName",
    "customer.lastName",
    "lastName",
  ]);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || pickText(payload, ["record.title"]);
}

function postalFromAddress(address: string | null): string | null {
  if (!address) return null;
  return address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? null;
}

function normalizedStage(payload: unknown): string | null {
  const recordStage = stageName(getPath(payload, "record.stage"));
  return (
    recordStage ??
    pickText(payload, [
      "record.status",
      "record.requestStatus",
      "event.currentStatus",
      "status",
      "stage",
      "projectStage",
      "projectStatus",
    ])
  );
}

export function buildCoperniqWebhookRow(params: {
  payload: unknown;
  rawBody: string;
  requestHeaders?: Record<string, string>;
}): CoperniqWebhookRow {
  const { payload, rawBody, requestHeaders } = params;
  const event = isObject(getPath(payload, "event")) ? (getPath(payload, "event") as JsonObject) : {};
  const record = isObject(getPath(payload, "record")) ? (getPath(payload, "record") as JsonObject) : {};
  const workOrder = isObject(getPath(payload, "workOrder")) ? (getPath(payload, "workOrder") as JsonObject) : {};
  const address = pickText(payload, ["record.address", "address", "site.address"]);
  const name = customerName(payload);

  return {
    event_id: text(event.eventId),
    record_id: text(record.id ?? event.recordId),
    record_uid: text(record.uid),
    record_type: text(record.type),
    trigger_key: text(event.triggerKey),
    trigger_name: text(event.triggerName),
    fired_at: text(event.firedAt),
    work_order_id: text(workOrder.id ?? event.workOrderId),
    project_id:
      pickText(payload, ["record.uid", "record.id", "event.recordId", "projectId"]) ?? null,
    customer_name: name,
    customer_email: pickEmail(payload, [
      "record.primaryEmail",
      "record.primaryContact.email",
      "record.customer.email",
      "customer.email",
      "customerEmail",
      "email",
    ]),
    address,
    city: pickText(payload, ["record.city", "city", "site.city"]),
    state_code: pickText(payload, ["record.state", "state", "site.state"]),
    postal_code:
      pickText(payload, [
        "record.zip",
        "record.postalCode",
        "record.postal_code",
        "zip",
        "postalCode",
        "postal_code",
      ]) ?? postalFromAddress(address),
    system_size_kw: pickNumber(payload, [
      "record.systemSizeKw",
      "record.systemSize",
      "systemSizeKw",
      "systemSize",
      "system_size_kw",
    ], ["system size kw", "system size", "system_size_kw", "pv size", "kw"]),
    contract_signed_date: pickDate(payload, [
      "record.contractSignedDate",
      "contractSignedDate",
      "contract_signed_date",
      "contractDate",
    ], ["contract signed date", "contract date", "signed date"]),
    total_system_cost: pickNumber(payload, [
      "record.dealValue",
      "record.totalSystemCost",
      "totalSystemCost",
      "total_system_cost",
    ], ["total system cost", "deal value", "contract amount", "contract value"]),
    project_stage: normalizedStage(payload),
    install_date: pickDate(payload, [
      "record.installDate",
      "installDate",
      "install_date",
      "workOrder.completionDate",
    ], ["install date", "installation date"]),
    setter_name: pickText(payload, [
      "record.setter.name",
      "setter.name",
      "setterName",
    ], ["setter name", "setter"]),
    setter_email: pickEmail(payload, [
      "record.setter.email",
      "setter.email",
      "setterEmail",
    ], ["setter email"]),
    sales_rep_name: pickText(payload, [
      "record.salesRep.name",
      "record.owner.name",
      "salesRep.name",
      "salesRepName",
      "sales_rep_name",
    ], ["sales rep name", "sales advisor name", "owner name", "closer name"]),
    sales_rep_email: pickEmail(payload, [
      "record.salesRep.email",
      "record.owner.email",
      "salesRep.email",
      "salesRepEmail",
      "sales_rep_email",
    ], ["sales rep email", "sales advisor email", "owner email", "closer email"]),
    gross_ppw: pickNumber(payload, ["grossPpw", "gross_ppw"], ["gross ppw", "gross_ppw"]),
    net_ppw: pickNumber(payload, ["netPpw", "net_ppw", "ppw"], ["net ppw", "net_ppw", "ppw"]),
    adders: pickNumber(payload, ["adders", "adderAmount", "adder_amount"], ["adders", "adder amount"]),
    finance_type: pickText(payload, ["financeType", "finance_type"], ["finance type", "finance_type"]),
    raw_body: rawBody,
    raw_payload: payload,
    request_headers: requestHeaders,
  };
}

export async function insertCoperniqWebhook(row: CoperniqWebhookRow): Promise<string | null> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("coperniq_webhooks")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return typeof data?.id === "string" ? data.id : null;
}
