import {
  patchPublicDealFromHub,
  syncPublicDealFromHub,
  type PublicDealSyncInput,
} from "@/lib/data-hub/public-deals-sync";
import { listAllPublicDeals, publicDealProjectId } from "@/lib/public-deals/client";

const TAPE_API_BASE = "https://api.tapeapp.com";
const PAGE_LIMIT = 50;
const UPSERT_CHUNK_SIZE = 500;
const PROJECT_ID_PREFIX = "tape_owe_";
const INSTALLER_VALUE = "OWE";

export type TapeField = {
  external_id?: string;
  values?: Array<Record<string, unknown>>;
};

export type TapeRecord = {
  record_id: number;
  fields?: TapeField[];
};

type TapeListResponse = {
  total?: number;
  cursor?: string;
  records?: TapeRecord[];
  error_message?: string;
};

export type TapeOweSyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
};

function getTapeApiKey(): string {
  const token = process.env.TAPE_API_KEY?.trim();
  if (!token) {
    throw new Error("Missing TAPE_API_KEY env var");
  }
  return token;
}

function getTapeOweViewId(): number {
  const raw = (process.env.TAPE_OWE_VIEW_ID ?? process.env.TAPE_CUSTOMERS_VIEW_ID ?? "").trim();
  if (!raw) {
    throw new Error("Missing TAPE_OWE_VIEW_ID (or TAPE_CUSTOMERS_VIEW_ID) env var");
  }
  const viewId = Number(raw);
  if (!Number.isFinite(viewId) || viewId <= 0) {
    throw new Error(`Invalid Tape view id: ${raw}`);
  }
  return viewId;
}

function sanitizeString(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDFFF]/g, (ch, offset, str) => {
      const code = ch.charCodeAt(0);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = str.charCodeAt(offset + 1);
        if (next >= 0xdc00 && next <= 0xdfff) return ch;
      }
      if (code >= 0xdc00 && code <= 0xdfff) {
        const prev = offset > 0 ? str.charCodeAt(offset - 1) : NaN;
        if (prev >= 0xd800 && prev <= 0xdbff) return ch;
      }
      return "\uFFFD";
    });
}

function sanitizeRow(
  row: Record<string, string | number | null>,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" ? sanitizeString(v) : v;
  }
  return out;
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

function addressPart(record: TapeRecord, key: string): string | null {
  const field = getField(record, "address");
  const part = field?.values?.[0]?.[key];
  return part ? String(part).trim() : null;
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

function splitName(value: string | null): { firstName: string | null; lastName: string | null } {
  const raw = (value ?? "").trim();
  if (!raw) return { firstName: null, lastName: null };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function pickFirst(...values: Array<string | null>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
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

export function mapTapeRecordToProject(
  record: TapeRecord,
): Record<string, string | number | null> | null {
  if (!Number.isFinite(record.record_id)) return null;

  const pid = textField(record, "our_");
  const customerName = textField(record, "customer_name");
  const { firstName, lastName } = splitName(customerName);

  return {
    tape_record_id: record.record_id,
    project_id: pickFirst(pid, `${PROJECT_ID_PREFIX}${record.record_id}`),
    opportunity_name: pickFirst(customerName, pid),
    first_name: firstName,
    last_name: lastName,
    address_line1: addressPart(record, "street_address"),
    city: addressPart(record, "city"),
    state_code: pickFirst(relationTitle(record, "state"), addressPart(record, "state")),
    postal_code: addressPart(record, "postal_code"),
    email: textField(record, "email_address"),
    phone: textField(record, "phone_number"),
    project_stage: pickFirst(textField(record, "job_status"), textField(record, "ntp_app_status")),
    contract_signed_date: dateField(record, "sale_date"),
    total_system_cost: decimalField(record, "total_system_cost_calc__h"),
    system_size_kw: decimalField(record, "contracted_system_size"),
    sales_advisor_name: relationTitle(record, "primary_sales_rep"),
    setter_name: relationTitle(record, "setter"),
    closer_name: pickFirst(
      relationTitle(record, "primary_sales_rep"),
      relationTitle(record, "secondary_account_executive"),
    ),
    market: relationTitle(record, "market"),
    team: relationTitle(record, "team"),
    region: relationTitle(record, "region"),
    division: relationTitle(record, "division"),
    dealer_name: relationTitle(record, "dealer"),
    office_name: relationTitle(record, "office"),
    installer: INSTALLER_VALUE,
  };
}

export function buildTapeOwePublicDealSyncInput(
  row: Record<string, string | number | null>,
): PublicDealSyncInput {
  const { tape_record_id: tapeRecordId, ...project } = row;
  return {
    installer: typeof project.installer === "string" ? project.installer : INSTALLER_VALUE,
    project,
    vendorKey:
      tapeRecordId == null || tapeRecordId === ""
        ? undefined
        : { tape_record_id: String(tapeRecordId) },
  };
}

async function fetchExistingProjectIds(projectIds: string[]): Promise<Set<string>> {
  const wanted = new Set(projectIds);
  return new Set(
    (await listAllPublicDeals())
      .map(publicDealProjectId)
      .filter((id) => wanted.has(id)),
  );
}

async function upsertProjects(
  rows: Record<string, string | number | null>[],
  existingProjectIds: Set<string>,
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE).map(sanitizeRow);
    await Promise.all(
      chunk.map((project) => {
        const projectId = typeof project.project_id === "string" ? project.project_id : "";
        return existingProjectIds.has(projectId)
          ? patchPublicDealFromHub(buildTapeOwePublicDealSyncInput(project))
          : syncPublicDealFromHub(buildTapeOwePublicDealSyncInput(project));
      }),
    );
  }
}

export async function runTapeOweSync(): Promise<TapeOweSyncResult> {
  const token = getTapeApiKey();
  const viewId = getTapeOweViewId();
  const records = await fetchAllTapeRecords(token, viewId);

  const mapped: Record<string, string | number | null>[] = [];
  let skipped = 0;
  for (const record of records) {
    const row = mapTapeRecordToProject(record);
    if (!row) {
      skipped++;
      continue;
    }
    mapped.push(sanitizeRow(row));
  }

  const projectIds = mapped
    .map((row) => row.project_id)
    .filter((v): v is string => typeof v === "string");
  const existing = await fetchExistingProjectIds(projectIds);
  let inserted = 0;
  let updated = 0;
  for (const id of projectIds) {
    if (existing.has(id)) updated++;
    else inserted++;
  }

  await upsertProjects(mapped, existing);

  return {
    fetched: records.length,
    inserted,
    updated,
    skipped,
  };
}
