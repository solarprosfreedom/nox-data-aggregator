// Sequifi marketplace API client (sales endpoint).
//
// Read:  GET  /v1/sales            -> paginated list (data.Sales[])
// Write: POST /v1/sales            -> upsert by `pid` (body: { data: [ ... ] })
//
// Confirmed against the live API:
//  - Upsert is keyed on `pid` (no duplicates created for an existing pid).
//  - Solar records require: pid, customer_name, kw, customer_signoff,
//    customer_state, location_code ({STATE}.{InstallerCode}, e.g. CA.Axia).
//  - Hub pushes sale detail only; remittance/M1/M2/M3 stay in the hub.
//  - Validation failures return HTTP 400 with data.errors[] strings that are
//    prefixed "Record [i]: ..." so we can isolate the offending records.

const DEFAULT_BASE = "https://marketplace-api.sequifi.com";

function baseUrl(): string {
  return (process.env.SEQUIFI_API_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function getToken(): string {
  const token = process.env.SEQUIFI_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("Sequifi not configured. Set SEQUIFI_ACCESS_TOKEN in .env.local.");
  }
  return token;
}

// ── Read shapes ───────────────────────────────────────────────────────────────

export type SequifiRepDetail = {
  id: number;
  first_name: string | null;
  last_name: string | null;
} | null;

export type SequifiSale = {
  id: number | null;
  pid: string;
  customer_name: string | null;
  customer_state: string | null;
  kw: number | null;
  gross_account_value: number | null;
  net_epc: number | null;
  total_commission: number | null;
  customer_signoff: string | null;
  install_partner: string | null;
  job_status: string | null;
  closer1: SequifiRepDetail;
  setter1: SequifiRepDetail;
};

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toRepDetail(v: unknown): SequifiRepDetail {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    first_name: typeof o.first_name === "string" ? o.first_name : null,
    last_name: typeof o.last_name === "string" ? o.last_name : null,
  };
}

function normalizeSale(raw: Record<string, unknown>): SequifiSale | null {
  const pid = typeof raw.pid === "string" ? raw.pid.trim() : String(raw.pid ?? "").trim();
  if (!pid) return null;
  return {
    id: toNum(raw.id),
    pid,
    customer_name: typeof raw.customer_name === "string" ? raw.customer_name : null,
    customer_state: typeof raw.customer_state === "string" ? raw.customer_state : null,
    kw: toNum(raw.system_size_kw) ?? toNum(raw.system_size) ?? toNum(raw.kw),
    gross_account_value: toNum(raw.gross_account_value),
    net_epc: toNum(raw.net_epc),
    total_commission: toNum(raw.total_commission),
    customer_signoff: typeof raw.customer_signoff === "string" ? raw.customer_signoff : null,
    install_partner: typeof raw.install_partner === "string" ? raw.install_partner : null,
    job_status: typeof raw.job_status === "string" ? raw.job_status : null,
    closer1: toRepDetail(raw.closer1_detail),
    setter1: toRepDetail(raw.setter1_detail),
  };
}

/** Pulls every sale from Sequifi (paginated, 100/page). */
export async function fetchAllSequifiSales(): Promise<SequifiSale[]> {
  const token = getToken();
  const all: SequifiSale[] = [];
  const perPage = 100;

  for (let page = 1; page <= 500; page++) {
    const url = `${baseUrl()}/v1/sales?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Sequifi GET /v1/sales failed (${res.status}): ${text.slice(0, 300)}`);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("Sequifi /v1/sales returned invalid JSON");
    }

    const data = (parsed.data ?? {}) as Record<string, unknown>;
    const rows = (data.Sales ?? data.sales) as unknown;
    const batch = Array.isArray(rows) ? rows : [];
    for (const item of batch) {
      if (item && typeof item === "object") {
        const sale = normalizeSale(item as Record<string, unknown>);
        if (sale) all.push(sale);
      }
    }

    const lastPage = toNum(data.last_page) ?? page;
    if (batch.length < perPage || page >= lastPage) break;
  }

  return all;
}

// ── Write shapes ──────────────────────────────────────────────────────────────

export type SequifiUpsertRecord = {
  pid: string;
  customer_name: string;
  kw: number;
  customer_signoff: string; // YYYY-MM-DD
  customer_state: string;
  location_code: string;
  gross_account_value?: number | null;
  install_partner?: string | null;
  job_status?: string | null;
  setter1_name?: string | null;
  setter1_email?: string | null;
  setter1_id?: number | null;
  closer1_name?: string | null;
  closer1_email?: string | null;
  closer1_id?: number | null;
  gross_epc?: number | null;
  net_epc?: number | null;
  adders?: number | null;
  dealer_fee_amount?: number | null;
  finance_type?: string | null;
  financier?: string | null;
};

export type UpsertOutcome = {
  processed: number;
  inserted: number;
  patched: number;
  succeededPids: Set<string>;
  errors: { pid: string; message: string }[];
};

type ChunkResult =
  | { ok: true; inserted: number; patched: number; processed: number }
  | { ok: false; message: string; failedIndices?: Set<number>; indexMessages?: Map<number, string> };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postChunk(records: SequifiUpsertRecord[]): Promise<ChunkResult> {
  const token = getToken();
  const res = await fetch(`${baseUrl()}/v1/sales`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ data: records }),
    cache: "no-store",
  });
  const text = await res.text();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* keep parsed empty; fall through to error handling */
  }
  const data = (parsed.data ?? {}) as Record<string, unknown>;

  if (res.ok) {
    return {
      ok: true,
      inserted: toNum(data.recordsInserted) ?? 0,
      patched: toNum(data.recordsPatched) ?? 0,
      processed: toNum(data.recordsProcessed) ?? records.length,
    };
  }

  // Parse per-record validation errors ("Record [i]: message").
  const errs = Array.isArray(data.errors) ? (data.errors as unknown[]) : [];
  if (errs.length) {
    const failedIndices = new Set<number>();
    const indexMessages = new Map<number, string>();
    for (const e of errs) {
      const msg = String(e);
      const m = msg.match(/Record \[(\d+)\]/);
      if (m) {
        const idx = Number(m[1]);
        failedIndices.add(idx);
        const prev = indexMessages.get(idx);
        indexMessages.set(idx, prev ? `${prev}; ${msg}` : msg);
      }
    }
    if (failedIndices.size) {
      return { ok: false, message: errs.join("; "), failedIndices, indexMessages };
    }
  }

  const message =
    typeof parsed.message === "string"
      ? parsed.message
      : `Sequifi POST /v1/sales failed (${res.status})`;
  return { ok: false, message: `${message}${text ? `: ${text.slice(0, 200)}` : ""}` };
}

/**
 * Upserts sales in chunks. On a partial validation failure, retries the
 * non-offending records once so a few bad rows don't block the whole batch.
 */
export async function upsertSequifiSales(
  records: SequifiUpsertRecord[]
): Promise<UpsertOutcome> {
  const out: UpsertOutcome = {
    processed: 0,
    inserted: 0,
    patched: 0,
    succeededPids: new Set<string>(),
    errors: [],
  };
  const chunkSize = 50;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const result = await postChunk(chunk);

    if (result.ok) {
      out.inserted += result.inserted;
      out.patched += result.patched;
      out.processed += result.processed;
      for (const r of chunk) out.succeededPids.add(r.pid);
    } else if (result.failedIndices && result.failedIndices.size < chunk.length) {
      const good: SequifiUpsertRecord[] = [];
      chunk.forEach((rec, idx) => {
        if (result.failedIndices!.has(idx)) {
          out.errors.push({
            pid: rec.pid,
            message: result.indexMessages?.get(idx) ?? result.message,
          });
        } else {
          good.push(rec);
        }
      });
      if (good.length) {
        const retry = await postChunk(good);
        if (retry.ok) {
          out.inserted += retry.inserted;
          out.patched += retry.patched;
          out.processed += retry.processed;
          for (const r of good) out.succeededPids.add(r.pid);
        } else {
          for (const r of good) out.errors.push({ pid: r.pid, message: retry.message });
        }
      }
    } else {
      for (const r of chunk) out.errors.push({ pid: r.pid, message: result.message });
    }

    if (i + chunkSize < records.length) await sleep(300);
  }

  return out;
}
