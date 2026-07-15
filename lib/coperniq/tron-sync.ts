import {
  listPublicDeals,
  publicDealProjectId,
  type PublicDealRow,
} from "@/lib/public-deals/client";
import { syncPublicDealFromHub } from "@/lib/data-hub/public-deals-sync";

const DEFAULT_COPERNIQ_API_BASE = "https://api.coperniq.io/v1";
const COPERNIQ_PAGE_SIZE = 100;
const WRITE_CONCURRENCY = 4;

type JsonRecord = Record<string, unknown>;

export type CoperniqPerson = {
  id?: number | string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type CoperniqUser = CoperniqPerson & {
  email?: string | null;
};

export type CoperniqProject = {
  id: number | string;
  title?: string | null;
  status?: string | null;
  workflowName?: string | null;
  phase?: { name?: string | null } | null;
  trades?: string[] | null;
  value?: number | null;
  size?: number | null;
  salesRep?: CoperniqPerson | null;
  owner?: CoperniqPerson | null;
  description?: string | null;
  lastActivity?: string | null;
  number?: number | string | null;
  jurisdiction?: { name?: string | null } | null;
  zipcode?: string | null;
  state?: string | null;
  street?: string | null;
  city?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  address?: string[] | null;
  custom?: JsonRecord | null;
};

export type CoperniqTronSyncResult = {
  fetched: number;
  liveTronRows: number;
  inserted: number;
  updated: number;
  unchanged: number;
  identityConflicts: number;
  errors: Array<{ projectId: string; message: string }>;
};

type MappedCoperniqProject = {
  project: JsonRecord;
  remittance: JsonRecord;
  rawRow: JsonRecord;
};

function requiredCoperniqApiKey() {
  const key = process.env.COPERNIQ_API_KEY?.trim();
  if (!key) throw new Error("Missing COPERNIQ_API_KEY env var");
  return key;
}

function coperniqBaseUrl() {
  return (process.env.COPERNIQ_API_BASE_URL?.trim() || DEFAULT_COPERNIQ_API_BASE).replace(/\/$/, "");
}

function stringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function listValue(value: unknown): string | undefined {
  if (!Array.isArray(value)) return stringValue(value);
  const values = value.map(stringValue).filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values.join(", ") : undefined;
}

function firstListValue(value: unknown): string | undefined {
  if (!Array.isArray(value)) return stringValue(value);
  return value.map(stringValue).find((entry): entry is string => Boolean(entry));
}

function personName(person: CoperniqPerson | null | undefined): string | undefined {
  return [stringValue(person?.firstName), stringValue(person?.lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ") || undefined;
}

function dateOnly(value: unknown): string | undefined {
  const source = stringValue(value);
  if (!source) return undefined;
  const directDate = source.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (directDate) return directDate;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function currency(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  // The public-deals endpoint stores currency at two decimal places.
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function compact<T extends JsonRecord>(value: T): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function valueEquals(left: unknown, right: unknown): boolean {
  if (left == null || left === "") return right == null || right === "";
  if (right == null || right === "") return false;

  if (typeof left === "number" || typeof right === "number") {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
  }

  return normalizeText(left) === normalizeText(right);
}

function hasChanged(current: JsonRecord, next: JsonRecord) {
  return Object.entries(next).some(([key, value]) => !valueEquals(current[key], value));
}

function identityName(row: PublicDealRow) {
  const project = row.project ?? {};
  return normalizeText(
    [project.first_name, project.last_name].filter(Boolean).join(" ") || project.opportunity_name,
  );
}

function sameIdentity(project: CoperniqProject, row: PublicDealRow) {
  const name = normalizeText(project.title);
  const email = normalizeText(project.primaryEmail);
  const phone = normalizePhone(project.primaryPhone);
  const rowProject = row.project ?? {};

  return Boolean(
    name &&
      ((email && email === normalizeText(rowProject.email) && name === identityName(row)) ||
        (phone && phone === normalizePhone(rowProject.phone) && name === identityName(row))),
  );
}

/** Fetches every active Coperniq project. The API returns 20 by default, so pagination is mandatory. */
export async function listCoperniqProjects(): Promise<CoperniqProject[]> {
  const rows: CoperniqProject[] = [];
  const key = requiredCoperniqApiKey();

  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({ page_size: String(COPERNIQ_PAGE_SIZE), page: String(page) });
    const response = await fetch(`${coperniqBaseUrl()}/projects?${params}`, {
      headers: { "x-api-key": key, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Coperniq projects GET failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }

    const pageRows = (await response.json()) as unknown;
    if (!Array.isArray(pageRows)) throw new Error("Coperniq projects API returned an invalid response");
    rows.push(...(pageRows as CoperniqProject[]));
    if (pageRows.length < COPERNIQ_PAGE_SIZE) return rows;
  }
}

/** Fetches the Coperniq people directory used to resolve project-owner emails. */
export async function listCoperniqUsers(): Promise<CoperniqUser[]> {
  const users = new Map<string, CoperniqUser>();
  const key = requiredCoperniqApiKey();

  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({ page_size: String(COPERNIQ_PAGE_SIZE), page: String(page) });
    const response = await fetch(`${coperniqBaseUrl()}/users?${params}`, {
      headers: { "x-api-key": key, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Coperniq users GET failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }

    const pageRows = (await response.json()) as unknown;
    if (!Array.isArray(pageRows)) throw new Error("Coperniq users API returned an invalid response");

    const before = users.size;
    for (const user of pageRows as CoperniqUser[]) {
      const id = stringValue(user.id);
      if (id) users.set(id, user);
    }
    // Coperniq currently returns the complete user directory even with page_size set.
    // Stop if the API ignored page pagination to avoid re-reading the same directory forever.
    if (pageRows.length < COPERNIQ_PAGE_SIZE || users.size === before) return [...users.values()];
  }
}

/** Maps Coperniq's project and custom-field schema into the Lovable public-deals schema. */
export function mapCoperniqProjectToTron(
  project: CoperniqProject,
  usersById: ReadonlyMap<string, CoperniqUser> = new Map(),
): MappedCoperniqProject {
  const custom = project.custom ?? {};
  const title = stringValue(project.title);
  const contractDate = dateOnly(custom.contract_signed_date);
  const utilityProvider = firstListValue(custom.utility_company);
  const siteAddress = stringValue(project.address?.[0]) ?? stringValue(project.street);
  const setterName = personName(project.owner);
  const setterEmail = stringValue(
    project.owner?.id == null ? undefined : usersById.get(String(project.owner.id))?.email,
  );

  return {
    project: compact({
      project_id: String(project.id),
      opportunity_name: title,
      address_line1: siteAddress,
      city: stringValue(project.city),
      state_code: stringValue(project.state),
      postal_code: stringValue(project.zipcode),
      email: stringValue(project.primaryEmail),
      phone: stringValue(project.primaryPhone),
      project_stage: stringValue(project.phase?.name) ?? stringValue(project.workflowName) ?? stringValue(project.status),
      total_system_cost: currency(project.value),
      system_size_kw: project.size ?? undefined,
      sales_advisor_name: personName(project.salesRep),
      setter_name: setterName,
      setter_email: setterEmail,
      utility_provider: utilityProvider,
    }),
    remittance: compact({
      sales_partner: firstListValue(custom.dealer_company),
      sales_advisor: stringValue(custom.sales_closer_name),
      channel: firstListValue(custom.lead_source) ?? firstListValue(custom.deal_type),
      finance_type: firstListValue(custom.ownership_type),
      financier: firstListValue(custom.financing_provider),
      utility_provider: utilityProvider,
      pv_size: custom.system_size_stc_dc_kw ?? custom.system_size_kw_dc,
      contract_amount: custom.gross_contract_price,
      gross_ppw: custom.gross_ppw,
      ppw: custom.net_ppw,
      contract_date: contractDate,
    }),
    // The source snapshot is intentionally limited to mapped data. In particular, do not copy
    // streetViewUrl because Coperniq can embed third-party API credentials in that URL.
    rawRow: compact({
      source_project_id: project.id,
      source_number: project.number,
      account_title: title,
      title,
      status: project.status,
      workflow: project.workflowName,
      phase: project.phase?.name,
      trades: listValue(project.trades),
      project_value: project.value,
      project_size: project.size,
      project_manager: personName(custom.install_manager as CoperniqPerson | undefined),
      owner: setterName,
      setter_name: setterName,
      setter_email: setterEmail,
      description: project.description,
      last_activity: project.lastActivity,
      // Requested Tron legacy mapping: Coperniq utility company → ahj.
      ahj: utilityProvider,
      source_created_at: project.createdAt,
      source_updated_at: project.updatedAt,
      site_address: siteAddress,
    }),
  };
}

async function forEachWithConcurrency<T>(
  values: T[],
  work: (value: T) => Promise<void>,
  concurrency = WRITE_CONCURRENCY,
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      await work(values[index]!);
    }
  });
  await Promise.all(workers);
}

/**
 * Upserts Coperniq into the live Tron public-deals table. Existing remittance data is merged
 * before PUT because the upstream endpoint replaces its remittance JSON object on each write.
 */
export async function runCoperniqTronSync(options: { dryRun: boolean }): Promise<CoperniqTronSyncResult> {
  const [sourceProjects, sourceUsers, liveRows] = await Promise.all([
    listCoperniqProjects(),
    listCoperniqUsers(),
    listPublicDeals("tron"),
  ]);
  const usersById = new Map(sourceUsers.map((user) => [String(user.id), user]));
  const byProjectId = new Map(liveRows.map((row) => [publicDealProjectId(row), row]));
  const result: CoperniqTronSyncResult = {
    fetched: sourceProjects.length,
    liveTronRows: liveRows.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    identityConflicts: 0,
    errors: [],
  };

  const work: Array<{
    source: CoperniqProject;
    project: JsonRecord;
    remittance: JsonRecord;
    rawRow: JsonRecord;
    action: "insert" | "update";
  }> = [];
  for (const source of sourceProjects) {
    const projectId = String(source.id);
    const existing = byProjectId.get(projectId);
    const mapped = mapCoperniqProjectToTron(source, usersById);

    if (existing) {
      const mergedProject = { ...(existing.project ?? {}), ...mapped.project };
      const mergedRemittance = { ...(existing.remittance ?? {}), ...mapped.remittance };
      if (!hasChanged(existing.project ?? {}, mapped.project) && !hasChanged(existing.remittance ?? {}, mapped.remittance)) {
        result.unchanged += 1;
        continue;
      }
      work.push({
        source,
        project: mergedProject,
        remittance: mergedRemittance,
        rawRow: mapped.rawRow,
        action: "update",
      });
      continue;
    }

    if (liveRows.some((row) => sameIdentity(source, row))) {
      result.identityConflicts += 1;
      continue;
    }
    work.push({
      source,
      project: mapped.project,
      remittance: mapped.remittance,
      rawRow: mapped.rawRow,
      action: "insert",
    });
  }

  if (options.dryRun) {
    result.inserted = work.filter((item) => item.action === "insert").length;
    result.updated = work.filter((item) => item.action === "update").length;
    return result;
  }

  await forEachWithConcurrency(work, async ({ source, project, remittance, rawRow, action }) => {
    try {
      await syncPublicDealFromHub({
        installer: "Tron",
        project,
        remittance,
        source: { fileName: "Coperniq API /v1/projects", rawRow },
      });
      if (action === "insert") result.inserted += 1;
      else result.updated += 1;
    } catch (error) {
      result.errors.push({
        projectId: String(source.id),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return result;
}
