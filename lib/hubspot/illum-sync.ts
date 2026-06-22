import { createServerSupabase } from "@/lib/supabase/server";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const SYNC_KEY = "hubspot_illum_deals";
const PROJECT_ID_PREFIX = "hubspot_";
const DEFAULT_PAGE_SIZE = 100;
const UPSERT_CHUNK_SIZE = 500;
const INSTALLER_VALUE = "Illum";

const DEAL_PROPERTIES = [
  "hs_object_id",
  "dealname",
  "dealstage",
  "pipeline",
  "closedate",
  "contact_name",
  "street_address",
  "city",
  "postal_code",
  "phone_number",
  "sales_rep",
  "contract",
  "hs_lastmodifieddate",
] as const;

type HubSpotDeal = {
  id: string;
  properties: Partial<Record<(typeof DEAL_PROPERTIES)[number], string>>;
};

type HubSpotSearchResponse = {
  results?: HubSpotDeal[];
  paging?: { next?: { after?: string } };
};

type PipelineStage = { id: string; label: string };
type Pipeline = { id: string; label: string; stages: PipelineStage[] };
type PipelineResponse = { results?: Pipeline[] };

type SyncStateRow = {
  sync_key: string;
  last_modified_at: string | null;
};

export type HubSpotIllumSyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  lastModifiedAt: string | null;
};

function getHubSpotToken(): string {
  const token = process.env.HUB_SPOT_ILLUM?.trim();
  if (!token) {
    throw new Error("Missing HUB_SPOT_ILLUM env var");
  }
  return token;
}

function parseIsoToMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function toDateOnly(value: string | undefined): string | null {
  const ms = parseIsoToMs(value);
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function parseContract(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function splitContactName(value: string | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const raw = (value ?? "").trim();
  if (!raw) return { firstName: null, lastName: null };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? null, lastName: null };
  }
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

/** Strip null bytes (rejected by Postgres) and lone UTF-16 surrogates (rejected by Node ≥24 JSON). */
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

async function hubSpotRequest<T>(
  token: string,
  path: string,
  options?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const method = options?.method ?? "GET";
  const res = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HubSpot ${res.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // Sanitize lone surrogates and retry
    return JSON.parse(sanitizeString(text)) as T;
  }
}

async function loadStageLabels(token: string): Promise<{
  byPipelineStage: Map<string, string>;
  byStage: Map<string, string>;
}> {
  const data = await hubSpotRequest<PipelineResponse>(token, "/crm/v3/pipelines/deals");
  const byPipelineStage = new Map<string, string>();
  const byStage = new Map<string, string>();
  for (const pipeline of data.results ?? []) {
    for (const stage of pipeline.stages ?? []) {
      byPipelineStage.set(`${pipeline.id}:${stage.id}`, stage.label);
      if (!byStage.has(stage.id)) byStage.set(stage.id, stage.label);
    }
  }
  return { byPipelineStage, byStage };
}

function resolveStageLabel(
  pipelineId: string | undefined,
  stageId: string | undefined,
  labels: { byPipelineStage: Map<string, string>; byStage: Map<string, string> },
): string | null {
  if (!stageId) return null;
  if (pipelineId) {
    const scoped = labels.byPipelineStage.get(`${pipelineId}:${stageId}`);
    if (scoped) return scoped;
  }
  return labels.byStage.get(stageId) ?? stageId;
}

async function fetchDealsIncremental(
  token: string,
  sinceMs: number | null,
): Promise<{ deals: HubSpotDeal[]; maxLastModifiedMs: number | null }> {
  const deals: HubSpotDeal[] = [];
  let after: string | undefined;
  let maxLastModifiedMs: number | null = null;

  do {
    const body: {
      properties: readonly string[];
      sorts: string[];
      limit: number;
      after?: string;
      filterGroups?: { filters: { propertyName: string; operator: string; value: string }[] }[];
    } = {
      properties: DEAL_PROPERTIES,
      sorts: ["hs_lastmodifieddate"],
      limit: DEFAULT_PAGE_SIZE,
    };
    if (after) body.after = after;
    if (sinceMs != null) {
      body.filterGroups = [
        {
          filters: [
            {
              propertyName: "hs_lastmodifieddate",
              operator: "GT",
              value: String(sinceMs),
            },
          ],
        },
      ];
    }

    const page = await hubSpotRequest<HubSpotSearchResponse>(token, "/crm/v3/objects/deals/search", {
      method: "POST",
      body,
    });
    const batch = page.results ?? [];
    deals.push(...batch);

    for (const deal of batch) {
      const ms = parseIsoToMs(deal.properties.hs_lastmodifieddate);
      if (ms != null && (maxLastModifiedMs == null || ms > maxLastModifiedMs)) {
        maxLastModifiedMs = ms;
      }
    }
    after = page.paging?.next?.after;
  } while (after);

  return { deals, maxLastModifiedMs };
}

function mapDealToProjectRow(
  deal: HubSpotDeal,
  labels: { byPipelineStage: Map<string, string>; byStage: Map<string, string> },
): Record<string, string | number | null> | null {
  const p = deal.properties;
  const objectId = p.hs_object_id?.trim();
  if (!objectId) return null;

  const { firstName, lastName } = splitContactName(p.contact_name);
  const pipelineId = p.pipeline?.trim();
  const stageId = p.dealstage?.trim();
  const stageLabel = resolveStageLabel(pipelineId, stageId, labels);

  return {
    project_id: `${PROJECT_ID_PREFIX}${objectId}`,
    opportunity_name: p.dealname?.trim() || p.contact_name?.trim() || null,
    first_name: firstName,
    last_name: lastName,
    address_line1: p.street_address?.trim() || null,
    city: p.city?.trim() || null,
    postal_code: p.postal_code?.trim() || null,
    phone: p.phone_number?.trim() || null,
    project_stage: stageLabel,
    contract_signed_date: toDateOnly(p.closedate),
    total_system_cost: parseContract(p.contract),
    sales_advisor_name: p.sales_rep?.trim() || null,
    installer: INSTALLER_VALUE,
  };
}

async function loadSyncWatermark(): Promise<number | null> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("hubspot_sync_state")
    .select("sync_key,last_modified_at")
    .eq("sync_key", SYNC_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as SyncStateRow | null;
  return parseIsoToMs(row?.last_modified_at ?? undefined);
}

async function saveSyncState(params: {
  lastModifiedAt: string | null;
  status: "success" | "failed";
  message: string | null;
}): Promise<void> {
  const db = createServerSupabase();
  const payload = {
    sync_key: SYNC_KEY,
    last_modified_at: params.lastModifiedAt,
    last_run_at: new Date().toISOString(),
    last_status: params.status,
    last_error: params.message,
  };
  const { error } = await db.from("hubspot_sync_state").upsert(payload, {
    onConflict: "sync_key",
  });
  if (error) throw new Error(error.message);
}

async function fetchExistingProjectIds(projectIds: string[]): Promise<Set<string>> {
  const db = createServerSupabase();
  const existing = new Set<string>();
  for (let i = 0; i < projectIds.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = projectIds.slice(i, i + UPSERT_CHUNK_SIZE);
    const { data, error } = await db
      .from("projects")
      .select("project_id")
      .in("project_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = (row as { project_id: string | null }).project_id;
      if (id) existing.add(id);
    }
  }
  return existing;
}

async function upsertProjects(rows: Record<string, string | number | null>[]): Promise<void> {
  if (rows.length === 0) return;
  const db = createServerSupabase();
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE).map(sanitizeRow);
    const { error } = await db.from("projects").upsert(chunk, { onConflict: "project_id" });
    if (error) throw new Error(error.message);
  }
}

export async function runHubSpotIllumSync(options?: {
  fullRefresh?: boolean;
}): Promise<HubSpotIllumSyncResult> {
  const token = getHubSpotToken();
  const fullRefresh = options?.fullRefresh ?? false;
  const sinceMs = fullRefresh ? null : await loadSyncWatermark();

  try {
    const labels = await loadStageLabels(token);
    const { deals, maxLastModifiedMs } = await fetchDealsIncremental(token, sinceMs);

    const mapped: Record<string, string | number | null>[] = [];
    let skipped = 0;
    for (const deal of deals) {
      const row = mapDealToProjectRow(deal, labels);
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

    await upsertProjects(mapped);

    const lastModifiedAt =
      maxLastModifiedMs != null ? new Date(maxLastModifiedMs).toISOString() : null;
    await saveSyncState({ lastModifiedAt, status: "success", message: null });

    return {
      fetched: deals.length,
      inserted,
      updated,
      skipped,
      lastModifiedAt,
    };
  } catch (err) {
    await saveSyncState({
      lastModifiedAt: sinceMs != null ? new Date(sinceMs).toISOString() : null,
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
