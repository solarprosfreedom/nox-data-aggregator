import { createServerSupabase } from "@/lib/supabase/server";
import {
  inferCaliforniaStateFromZip,
  parseStateCode,
} from "@/lib/data-hub/normalize";
import { syncPublicDealFromHub } from "@/lib/data-hub/public-deals-sync";
import {
  deletePublicDeal,
  listAllPublicDeals,
  listPublicDeals,
  publicDealProjectId,
  type PublicDealRow,
} from "@/lib/public-deals/client";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const DEFAULT_PAGE_SIZE = 100;
const UPSERT_CHUNK_SIZE = 500;
const HUBSPOT_BATCH_SIZE = 100;
const ILLUM_MAMBAS_PIPELINE_ID = "default";
const ILLUM_MAMBAS_DEAL_NAME_TOKEN = "Mambas";

type HubSpotSyncConfig = {
  tokenEnvVar: string;
  syncKey: string;
  projectIdPrefix: string;
  installerValue: string;
};

const ILLUM_SYNC_CONFIG: HubSpotSyncConfig = {
  tokenEnvVar: "HUB_SPOT_ILLUM",
  syncKey: "hubspot_illum_deals",
  projectIdPrefix: "hubspot_",
  installerValue: "Illum",
};

const DEAL_PROPERTIES = [
  "hs_object_id",
  "amount",
  "dealname",
  "dealstage",
  "pipeline",
  "hubspot_owner_id",
  "createdate",
  "closedate",
  "contact_name",
  "street_address",
  "city",
  "postal_code",
  "phone_number",
  "sales_rep",
  "sales_rep_name__deal_",
  "sales_rep_email__deal_",
  "sales_rep_phone_number__deal_",
  "sales_rep_setter_name",
  "sales_rep_setter_email",
  "sales_rep_setter_phone_number",
  "system_size_in_kw",
  "contract",
  "hs_lastmodifieddate",
] as const;

const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "phone",
  "address",
  "city",
  "state",
  "zip",
] as const;

type ProjectPayloadValue = string | number | null | undefined;

export type HubSpotDeal = {
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
type HubSpotOwner = {
  id?: string;
  userId?: string | number;
  userIdIncludingInactive?: string | number;
  firstName?: string;
  lastName?: string;
  email?: string;
};
type HubSpotOwnersResponse = {
  results?: HubSpotOwner[];
  paging?: { next?: { after?: string } };
};
type OwnerInfo = { name: string | null; email: string | null };
type ContactInfo = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};
type HubSpotAssociationBatchResponse = {
  results?: {
    from?: { id?: string };
    to?: { toObjectId?: string | number; id?: string | number }[];
  }[];
};
type HubSpotContact = {
  id: string;
  properties?: Partial<Record<(typeof CONTACT_PROPERTIES)[number], string>>;
};
type HubSpotContactsBatchResponse = {
  results?: HubSpotContact[];
};

type SyncStateRow = {
  sync_key: string;
  last_modified_at: string | null;
};

export type HubSpotIllumSyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  staleDeleted: number;
  lastModifiedAt: string | null;
};

function getHubSpotToken(tokenEnvVar: string): string {
  const token = process.env[tokenEnvVar]?.trim();
  if (!token) {
    throw new Error(`Missing ${tokenEnvVar} env var`);
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

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[$,\s]/g, "").replace(/kw$/i, "").trim());
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
  row: Record<string, ProjectPayloadValue>,
): Record<string, ProjectPayloadValue> {
  const out: Record<string, ProjectPayloadValue> = {};
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

function ownerName(owner: HubSpotOwner): string | null {
  const first = owner.firstName?.trim() ?? "";
  const last = owner.lastName?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (full) return full;
  const email = owner.email?.trim();
  if (email) return email;
  return null;
}

async function loadOwnerDirectory(token: string): Promise<Map<string, OwnerInfo>> {
  const byId = new Map<string, OwnerInfo>();
  let after: string | undefined;

  do {
    const path = after
      ? `/crm/v3/owners/?limit=100&archived=true&after=${encodeURIComponent(after)}`
      : "/crm/v3/owners/?limit=100&archived=true";
    const page = await hubSpotRequest<HubSpotOwnersResponse>(token, path);

    for (const owner of page.results ?? []) {
      const info: OwnerInfo = {
        name: ownerName(owner),
        email: owner.email?.trim() || null,
      };
      const id = owner.id?.trim();
      if (id) byId.set(id, info);
      const userId = owner.userId != null ? String(owner.userId).trim() : "";
      if (userId) byId.set(userId, info);
      const userIdIncludingInactive =
        owner.userIdIncludingInactive != null ? String(owner.userIdIncludingInactive).trim() : "";
      if (userIdIncludingInactive) byId.set(userIdIncludingInactive, info);
    }

    after = page.paging?.next?.after;
  } while (after);

  return byId;
}

async function hydrateMissingOwners(
  token: string,
  ownerDirectory: Map<string, OwnerInfo>,
  ownerIds: string[],
): Promise<void> {
  for (const raw of ownerIds) {
    const id = raw.trim();
    if (!id || ownerDirectory.has(id)) continue;
    try {
      const owner = await hubSpotRequest<HubSpotOwner>(token, `/crm/v3/owners/${encodeURIComponent(id)}`);
      const info: OwnerInfo = {
        name: ownerName(owner),
        email: owner.email?.trim() || null,
      };
      ownerDirectory.set(id, info);
    } catch {
      // Keep sync resilient. Some ids may not resolve as owners.
      continue;
    }
  }
}

function chunked<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function loadDealContactDirectory(
  token: string,
  deals: HubSpotDeal[],
): Promise<Map<string, ContactInfo>> {
  const contactIdByDealId = new Map<string, string>();

  for (const chunk of chunked(deals, HUBSPOT_BATCH_SIZE)) {
    const body = {
      inputs: chunk.map((deal) => ({ id: deal.id })),
    };
    const data = await hubSpotRequest<HubSpotAssociationBatchResponse>(
      token,
      "/crm/v4/associations/deals/contacts/batch/read",
      { method: "POST", body },
    );

    for (const result of data.results ?? []) {
      const dealId = result.from?.id?.trim();
      const contactId = result.to?.[0]?.toObjectId ?? result.to?.[0]?.id;
      if (dealId && contactId != null) contactIdByDealId.set(dealId, String(contactId));
    }
  }

  const contactIds = [...new Set(contactIdByDealId.values())];
  if (!contactIds.length) return new Map();

  const contactsById = new Map<string, ContactInfo>();
  try {
    for (const chunk of chunked(contactIds, HUBSPOT_BATCH_SIZE)) {
      const data = await hubSpotRequest<HubSpotContactsBatchResponse>(
        token,
        "/crm/v3/objects/contacts/batch/read",
        {
          method: "POST",
          body: {
            properties: CONTACT_PROPERTIES,
            inputs: chunk.map((id) => ({ id })),
          },
        },
      );

      for (const contact of data.results ?? []) {
        const p = contact.properties ?? {};
        contactsById.set(contact.id, {
          email: p.email?.trim() || null,
          firstName: p.firstname?.trim() || null,
          lastName: p.lastname?.trim() || null,
          phone: p.phone?.trim() || null,
          address: p.address?.trim() || null,
          city: p.city?.trim() || null,
          state: p.state?.trim() || null,
          postalCode: p.zip?.trim() || null,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Some HubSpot private apps can read deal associations but not contact details.
    if (
      msg.includes("crm.objects.contacts.read") ||
      msg.includes("crm.objects.contacts.sensitive.read") ||
      msg.includes("MISSING_SCOPES")
    ) {
      return new Map();
    }
    throw err;
  }

  const byDealId = new Map<string, ContactInfo>();
  for (const [dealId, contactId] of contactIdByDealId) {
    const contact = contactsById.get(contactId);
    if (contact) byDealId.set(dealId, contact);
  }
  return byDealId;
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

    const filters = buildIllumDealSearchFilters(sinceMs);
    body.filterGroups = [{ filters }];

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

export function buildIllumDealSearchFilters(sinceMs: number | null): {
  propertyName: string;
  operator: string;
  value: string;
}[] {
  const filters = [
    {
      propertyName: "pipeline",
      operator: "EQ",
      value: ILLUM_MAMBAS_PIPELINE_ID,
    },
    {
      propertyName: "dealname",
      operator: "CONTAINS_TOKEN",
      value: ILLUM_MAMBAS_DEAL_NAME_TOKEN,
    },
  ];
  if (sinceMs != null) {
    filters.push({
      propertyName: "hs_lastmodifieddate",
      operator: "GT",
      value: String(sinceMs),
    });
  }
  return filters;
}

export function mapIllumDealToProjectRow(
  deal: HubSpotDeal,
  labels: { byPipelineStage: Map<string, string>; byStage: Map<string, string> },
  ownerDirectory: Map<string, OwnerInfo>,
  contactByDealId = new Map<string, ContactInfo>(),
): Record<string, ProjectPayloadValue> | null {
  const p = deal.properties;
  const objectId = p.hs_object_id?.trim();
  if (!objectId) return null;

  const contact = contactByDealId.get(deal.id) ?? contactByDealId.get(objectId);
  const contactName = p.contact_name?.trim() || null;
  const { firstName, lastName } = splitContactName(contactName ?? undefined);
  const pipelineId = p.pipeline?.trim();
  const stageId = p.dealstage?.trim();
  const stageLabel = resolveStageLabel(pipelineId, stageId, labels);
  const salesRepRaw = p.sales_rep?.trim() || null;
  const salesRep = salesRepRaw ? ownerDirectory.get(salesRepRaw) : undefined;
  const setterName = p.sales_rep_setter_name?.trim() || null;
  const setterEmail = p.sales_rep_setter_email?.trim() || null;
  const salesAdvisorName =
    p.sales_rep_name__deal_?.trim() || salesRep?.name || salesRepRaw;
  const salesAdvisorEmail =
    p.sales_rep_email__deal_?.trim() || salesRep?.email || null;
  const streetAddress = p.street_address?.trim() || contact?.address?.trim() || null;
  const dealName = p.dealname?.trim() || null;
  const postalCode = p.postal_code?.trim() || contact?.postalCode?.trim() || null;
  const stateCode =
    parseStateCode(streetAddress, dealName) ??
    parseStateCode(contact?.state ?? null, null) ??
    inferCaliforniaStateFromZip(postalCode);

  return {
    project_id: `${ILLUM_SYNC_CONFIG.projectIdPrefix}${objectId}`,
    opportunity_name: dealName || contactName,
    first_name: contact?.firstName || firstName,
    last_name: contact?.lastName || lastName,
    address_line1: streetAddress,
    city: p.city?.trim() || contact?.city?.trim() || null,
    state_code: stateCode,
    postal_code: postalCode,
    email: contact?.email?.trim() || undefined,
    phone: contact?.phone?.trim() || p.phone_number?.trim() || null,
    project_stage: stageLabel,
    contract_signed_date: toDateOnly(p.closedate),
    total_system_cost: parseNumber(p.amount) ?? parseNumber(p.contract),
    system_size_kw: parseNumber(p.system_size_in_kw),
    setter_name: setterName,
    setter_email: setterEmail,
    sales_advisor_name: salesAdvisorName,
    sales_advisor_email: salesAdvisorEmail,
    installer: ILLUM_SYNC_CONFIG.installerValue,
    updated_at: p.hs_lastmodifieddate,
  };
}

async function loadSyncWatermark(syncKey: string): Promise<number | null> {
  const db = createServerSupabase();
  const { data, error } = await db
    .from("hubspot_sync_state")
    .select("sync_key,last_modified_at")
    .eq("sync_key", syncKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as SyncStateRow | null;
  return parseIsoToMs(row?.last_modified_at ?? undefined);
}

async function saveSyncState(
  syncKey: string,
  params: {
  lastModifiedAt: string | null;
  status: "success" | "failed";
  message: string | null;
},
): Promise<void> {
  const db = createServerSupabase();
  const payload = {
    sync_key: syncKey,
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

function addProjectIdAliases(target: Set<string>, value: string | null | undefined): void {
  const id = value?.trim();
  if (!id) return;
  target.add(id);
  if (id.startsWith("hubspot_")) target.add(id.slice("hubspot_".length));
  else target.add(`hubspot_${id}`);
}

async function fetchExistingPublicDealRows(
  projectIds: string[],
): Promise<Map<string, PublicDealRow>> {
  const wanted = new Set<string>();
  for (const id of projectIds) addProjectIdAliases(wanted, id);

  const existingByAlias = new Map<string, PublicDealRow>();
  for (const row of await listAllPublicDeals()) {
    const aliases = new Set<string>();
    addProjectIdAliases(aliases, publicDealProjectId(row));
    addProjectIdAliases(aliases, row.pk_value);
    if (![...aliases].some((id) => wanted.has(id))) continue;
    for (const alias of aliases) existingByAlias.set(alias, row);
  }
  return existingByAlias;
}

function preserveExistingEmail(
  row: Record<string, ProjectPayloadValue>,
  existingRows: Map<string, PublicDealRow>,
): void {
  if (row.email !== undefined) return;
  const projectId = typeof row.project_id === "string" ? row.project_id : "";
  if (!projectId) return;
  const existingEmail = existingRows.get(projectId)?.project?.email;
  if (typeof existingEmail === "string" && existingEmail.trim()) {
    row.email = existingEmail.trim();
  }
}

async function upsertProjects(rows: Record<string, ProjectPayloadValue>[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE).map(sanitizeRow);
    await Promise.all(
      chunk.map((project) =>
        syncPublicDealFromHub({
          installer: typeof project.installer === "string" ? project.installer : "Illum",
          project,
        }),
      ),
    );
  }
}

function publicDealAliases(row: PublicDealRow): Set<string> {
  const aliases = new Set<string>();
  addProjectIdAliases(aliases, publicDealProjectId(row));
  addProjectIdAliases(aliases, row.pk_value);
  return aliases;
}

function publicDealDeleteId(row: PublicDealRow): string {
  const pk = row.pk_value?.trim();
  if (pk) return pk;
  return publicDealProjectId(row).replace(/^hubspot_/, "");
}

async function deleteStaleIllumRows(projectIdsToKeep: string[]): Promise<number> {
  const keepAliases = new Set<string>();
  for (const id of projectIdsToKeep) addProjectIdAliases(keepAliases, id);

  const stale = (await listPublicDeals("illum")).filter((row) => {
    const aliases = publicDealAliases(row);
    return ![...aliases].some((id) => keepAliases.has(id));
  });

  for (const row of stale) {
    await deletePublicDeal("illum", publicDealDeleteId(row));
  }

  return stale.length;
}

async function runHubSpotSync(
  config: HubSpotSyncConfig,
  options?: {
  fullRefresh?: boolean;
},
): Promise<HubSpotIllumSyncResult> {
  const token = getHubSpotToken(config.tokenEnvVar);
  const fullRefresh = options?.fullRefresh ?? false;
  const sinceMs = fullRefresh ? null : await loadSyncWatermark(config.syncKey);

  try {
    const labels = await loadStageLabels(token);
    let ownerDirectory = new Map<string, OwnerInfo>();
    try {
      ownerDirectory = await loadOwnerDirectory(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Some HubSpot private apps don't have owners.read scope; keep syncing deals anyway.
      if (!msg.includes("crm.objects.owners.read") && !msg.includes("MISSING_SCOPES")) {
        throw err;
      }
    }
    const { deals, maxLastModifiedMs } = await fetchDealsIncremental(token, sinceMs);
    const contactByDealId = await loadDealContactDirectory(token, deals);
    const ownerIds = new Set<string>();
    for (const deal of deals) {
      const p = deal.properties;
      const ownerId = p.hubspot_owner_id?.trim();
      const salesRep = p.sales_rep?.trim();
      if (ownerId) ownerIds.add(ownerId);
      if (salesRep) ownerIds.add(salesRep);
    }
    await hydrateMissingOwners(token, ownerDirectory, [...ownerIds]);

    const mapped: Record<string, ProjectPayloadValue>[] = [];
    let skipped = 0;
    for (const deal of deals) {
      const row = mapIllumDealToProjectRow(deal, labels, ownerDirectory, contactByDealId);
      if (!row) {
        skipped++;
        continue;
      }
      mapped.push(sanitizeRow(row));
    }

    const projectIds = mapped
      .map((row) => row.project_id)
      .filter((v): v is string => typeof v === "string");
    const existing = await fetchExistingPublicDealRows(projectIds);
    for (const row of mapped) preserveExistingEmail(row, existing);
    let inserted = 0;
    let updated = 0;
    for (const id of projectIds) {
      if (existing.has(id)) updated++;
      else inserted++;
    }

    await upsertProjects(mapped);
    const staleDeleted = fullRefresh ? await deleteStaleIllumRows(projectIds) : 0;

    const lastModifiedAt =
      maxLastModifiedMs != null ? new Date(maxLastModifiedMs).toISOString() : null;
    await saveSyncState(config.syncKey, { lastModifiedAt, status: "success", message: null });

    return {
      fetched: deals.length,
      inserted,
      updated,
      skipped,
      staleDeleted,
      lastModifiedAt,
    };
  } catch (err) {
    await saveSyncState(config.syncKey, {
      lastModifiedAt: sinceMs != null ? new Date(sinceMs).toISOString() : null,
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function runHubSpotIllumSync(options?: {
  fullRefresh?: boolean;
}): Promise<HubSpotIllumSyncResult> {
  return runHubSpotSync(ILLUM_SYNC_CONFIG, options);
}
