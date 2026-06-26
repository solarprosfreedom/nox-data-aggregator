import { createServerSupabase } from "@/lib/supabase/server";

const TAPE_API_BASE = "https://api.tapeapp.com";
const PAGE_LIMIT = 50;
const UPSERT_CHUNK_SIZE = 10;

type TapeField = {
  external_id?: string;
  values?: Array<Record<string, unknown>>;
};

type TapeRecord = {
  record_id: number;
  fields?: TapeField[];
};

type TapeListResponse = {
  total?: number;
  cursor?: string;
  records?: TapeRecord[];
  error_message?: string;
};

export type TapeCustomersSyncResult = {
  viewId: number;
  fetched: number;
  upserted: number;
};

function getTapeApiKey(): string {
  const token = process.env.TAPE_API_KEY?.trim();
  if (!token) throw new Error("Missing TAPE_API_KEY env var");
  return token;
}

function getTapeCustomersViewId(): number {
  const raw = (process.env.TAPE_CUSTOMERS_VIEW_ID ?? "").trim();
  if (!raw) throw new Error("Missing TAPE_CUSTOMERS_VIEW_ID env var");
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid TAPE_CUSTOMERS_VIEW_ID: ${raw}`);
  return id;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function getField(record: TapeRecord, externalId: string): TapeField | undefined {
  return record.fields?.find((f) => f.external_id === externalId);
}

function textField(record: TapeRecord, externalId: string): string | null {
  const field = getField(record, externalId);
  const val = field?.values?.[0]?.value;
  if (val == null || val === "") return null;
  if (typeof val === "object" && val !== null && "text" in val) {
    return String((val as { text?: string }).text ?? "").trim() || null;
  }
  return stripHtml(String(val));
}

function decimalField(record: TapeRecord, externalId: string): number | null {
  const field = getField(record, externalId);
  const v = field?.values?.[0];
  if (v?.decimal != null) {
    const n = Number(v.decimal);
    return Number.isFinite(n) ? n : null;
  }
  const val = v?.value;
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function relationTitle(record: TapeRecord, externalId: string): string | null {
  const field = getField(record, externalId);
  const val = field?.values?.[0]?.value;
  if (val && typeof val === "object" && "title" in val) {
    return String((val as { title?: string }).title ?? "").trim() || null;
  }
  return null;
}

function relationId(record: TapeRecord, externalId: string): number | null {
  const field = getField(record, externalId);
  const val = field?.values?.[0]?.value;
  if (val && typeof val === "object" && "record_id" in val) {
    return Number((val as { record_id?: number }).record_id) || null;
  }
  return null;
}

function dateField(record: TapeRecord, externalId: string): string | null {
  const field = getField(record, externalId);
  const startDate = field?.values?.[0]?.start_date;
  if (!startDate) return null;
  const raw = String(startDate).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function addressPart(record: TapeRecord, key: string): string | null {
  const field = getField(record, "address");
  const part = field?.values?.[0]?.[key];
  return part ? String(part).trim() : null;
}

function mapRecord(record: TapeRecord): Record<string, unknown> {
  return {
    tape_record_id: record.record_id,
    pid: textField(record, "our_"),
    prospect_id: relationId(record, "prospect"),
    homeowner_id: record.record_id,
    product_name: relationTitle(record, "finance_company__rel"),
    customer_name: textField(record, "customer_name"),
    customer_address: addressPart(record, "street_address"),
    customer_city: addressPart(record, "city"),
    customer_state: relationTitle(record, "state"),
    customer_zip: addressPart(record, "postal_code"),
    customer_email: textField(record, "email_address"),
    customer_phone: textField(record, "phone_number"),
    gross_account_value: decimalField(record, "total_system_cost_calc__h"),
    job_status: textField(record, "job_status"),
    kw: decimalField(record, "contracted_system_size"),
    net_epc: decimalField(record, "net_epc"),
    sow_amount: decimalField(record, "total_system_cost_calc__h"),
    notes: textField(record, "next_steps___notes"),
    sale_date: dateField(record, "sale_date"),
    cancel_date: dateField(record, "cancel_date"),
    closer_1: relationTitle(record, "primary_sales_rep"),
    setter_1: relationTitle(record, "setter"),
    closer_2: relationTitle(record, "secondary_account_executive"),
    raw_tape: record,
    synced_at: new Date().toISOString(),
  };
}

async function fetchTapeViewPage(
  token: string,
  viewId: number,
  cursor?: string,
): Promise<TapeListResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) params.set("cursor", cursor);
  const url = `${TAPE_API_BASE}/v1/record/view/${viewId}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = (await res.json()) as TapeListResponse;
  if (!res.ok) {
    throw new Error(body.error_message ?? `Tape API HTTP ${res.status}`);
  }
  return body;
}

async function fetchAllTapeRecords(token: string, viewId: number): Promise<TapeRecord[]> {
  const all: TapeRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchTapeViewPage(token, viewId, cursor);
    const batch = page.records ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (page.total != null && all.length >= page.total) break;
    cursor = page.cursor;
  } while (cursor);
  return all;
}

async function upsertTapeCustomers(rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = createServerSupabase();
  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await db
      .from("tape_customers")
      .upsert(chunk, { onConflict: "tape_record_id" });
    if (error) throw new Error(error.message);
    upserted += chunk.length;
  }
  return upserted;
}

export async function runTapeCustomersSync(): Promise<TapeCustomersSyncResult> {
  const token = getTapeApiKey();
  const viewId = getTapeCustomersViewId();
  const records = await fetchAllTapeRecords(token, viewId);
  const rows = records.map(mapRecord);
  const upserted = await upsertTapeCustomers(rows);
  return {
    viewId,
    fetched: records.length,
    upserted,
  };
}
