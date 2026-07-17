import type { PublicDealVendor } from "@/lib/public-deals/client";

export type PublicImportSource = PublicDealVendor;

export type PublicImportLog = {
  id: string;
  source: PublicImportSource;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  filename: string | null;
  trigger_source: string | null;
  error: string | null;
  created_at: string | null;
};

export type CreatePublicImportLog = {
  source: PublicImportSource;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  filename?: string;
  trigger_source?: string;
  error?: string;
};

type PublicImportsListResponse = {
  data?: unknown;
  imports?: unknown;
};

const DEFAULT_BASE = "https://hub.noxpwr.com/api/public/imports";

function publicImportsBaseUrl() {
  const configured = process.env.PUBLIC_IMPORTS_API_BASE?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const dealsBase = process.env.PUBLIC_DEALS_API_BASE?.trim();
  if (dealsBase) {
    return dealsBase.replace(/\/deals\/?$/, "/imports").replace(/\/$/, "");
  }

  return DEFAULT_BASE;
}

function publicImportsApiKey() {
  return (
    process.env.PUBLIC_IMPORTS_API_KEY?.trim() ||
    process.env.PUBLIC_DEALS_API_KEY?.trim() ||
    process.env.DATA_HUB_API_KEY?.trim() ||
    ""
  );
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function asCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function normalizeImportLog(value: unknown, index: number): PublicImportLog | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const source = asString(row.source);
  if (!source) return null;

  return {
    id: asString(row.id) ?? `${source}-${asString(row.created_at) ?? index}`,
    source: source as PublicImportSource,
    row_count: asCount(row.row_count),
    inserted_count: asCount(row.inserted_count),
    updated_count: asCount(row.updated_count),
    filename: asString(row.filename) ?? asString(row.file_name),
    trigger_source: asString(row.trigger_source),
    error: asString(row.error) ?? asString(row.error_summary),
    created_at:
      asString(row.created_at) ?? asString(row.imported_at) ?? asString(row.completed_at),
  };
}

function responseRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];

  const response = body as PublicImportsListResponse;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.imports)) return response.imports;
  return [];
}

async function responseMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: string; detail?: string };
    return [body.error, body.detail].filter(Boolean).join(": ") || text;
  } catch {
    return text;
  }
}

/**
 * Reads the merged installer import history from the public data service.
 * The service applies source/since filters before sorting all sources newest first.
 */
export async function listPublicImportHistory(options: {
  source?: PublicImportSource | PublicImportSource[];
  limit?: number;
  since?: string;
} = {}): Promise<PublicImportLog[]> {
  const key = publicImportsApiKey();
  if (!key) throw new Error("Missing PUBLIC_IMPORTS_API_KEY, PUBLIC_DEALS_API_KEY, or DATA_HUB_API_KEY");

  const params = new URLSearchParams();
  const sources = options.source
    ? (Array.isArray(options.source) ? options.source : [options.source])
    : [];
  if (sources.length > 0) params.set("source", sources.join(","));
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.since?.trim()) params.set("since", options.since.trim());

  const query = params.toString();
  const response = await fetch(`${publicImportsBaseUrl()}${query ? `?${query}` : ""}`, {
    headers: { accept: "application/json", "x-api-key": key },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Public imports GET failed (${response.status}): ${await responseMessage(response)}`);
  }

  return responseRows(await response.json())
    .map(normalizeImportLog)
    .filter((row): row is PublicImportLog => row !== null);
}

/** Records one completed or failed installer import in its public source table. */
export async function createPublicImportLog(input: CreatePublicImportLog): Promise<unknown> {
  const key = publicImportsApiKey();
  if (!key) throw new Error("Missing PUBLIC_IMPORTS_API_KEY, PUBLIC_DEALS_API_KEY, or DATA_HUB_API_KEY");

  const response = await fetch(publicImportsBaseUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Public imports POST failed (${response.status}): ${await responseMessage(response)}`);
  }
  if (response.status === 204) return null;
  return response.json() as Promise<unknown>;
}

/**
 * Import logging must not turn an already-completed source sync into a failed
 * sync. The public endpoint remains the authoritative history when available.
 */
export async function recordPublicImportLog(input: CreatePublicImportLog): Promise<void> {
  try {
    await createPublicImportLog(input);
  } catch (error) {
    console.error("Unable to record public import history", error);
  }
}
