export type PublicDealVendor = "axia" | "illum" | "tron" | "empwr" | "goodpwr" | "owe";

export type PublicDealPayload = {
  vendor_key?: Record<string, unknown>;
  project: Record<string, unknown>;
  remittance?: Record<string, unknown>;
  source?: {
    file_name?: string;
    row_number?: number;
    raw_row?: Record<string, unknown>;
  };
};

export type PublicDealRow = {
  vendor: PublicDealVendor;
  installer: string;
  pk: string;
  pk_value: string;
  project: Record<string, unknown>;
  remittance: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
};

const DEFAULT_BASE = "https://hub.noxpwr.com/api/public/deals";

const INSTALLER_VENDOR_ALIASES: Array<[RegExp, PublicDealVendor]> = [
  [/axia/i, "axia"],
  [/illum/i, "illum"],
  [/\bowe\b/i, "owe"],
  [/tron/i, "tron"],
  [/empwr/i, "empwr"],
  [/good\s*pwr|goodpwr/i, "goodpwr"],
];

function publicDealsBaseUrl() {
  return (process.env.PUBLIC_DEALS_API_BASE ?? DEFAULT_BASE).replace(/\/$/, "");
}

function publicDealsApiKey() {
  return (
    process.env.PUBLIC_DEALS_API_KEY?.trim() ||
    process.env.DATA_HUB_API_KEY?.trim() ||
    ""
  );
}

export function installerToPublicDealVendor(
  installer: string | null | undefined,
): PublicDealVendor | null {
  const value = installer?.trim();
  if (!value) return null;
  for (const [pattern, vendor] of INSTALLER_VENDOR_ALIASES) {
    if (pattern.test(value)) return vendor;
  }
  return null;
}

export function isPublicDealsConfigured() {
  return Boolean(publicDealsBaseUrl() && publicDealsApiKey());
}

export const PUBLIC_DEAL_VENDORS: PublicDealVendor[] = [
  "axia",
  "illum",
  "tron",
  "empwr",
  "goodpwr",
  "owe",
];

export function compactPublicDealObject<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined) continue;
    if (typeof raw === "string" && raw.trim() === "") continue;
    (out as Record<string, unknown>)[key] = raw;
  }
  return out;
}

export async function putPublicDeal(
  vendor: PublicDealVendor,
  payload: PublicDealPayload,
) {
  const key = publicDealsApiKey();
  if (!key) {
    throw new Error("Missing PUBLIC_DEALS_API_KEY or DATA_HUB_API_KEY");
  }

  const response = await fetch(`${publicDealsBaseUrl()}/${vendor}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string; detail?: string };
      message = [json.error, json.detail].filter(Boolean).join(": ") || text;
    } catch {
      // Keep the raw text.
    }
    throw new Error(`Public deals ${vendor} PUT failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<unknown>;
}

export async function listPublicDeals(vendor: PublicDealVendor, limit = 5000) {
  const key = publicDealsApiKey();
  if (!key) {
    throw new Error("Missing PUBLIC_DEALS_API_KEY or DATA_HUB_API_KEY");
  }

  const response = await fetch(
    `${publicDealsBaseUrl()}/${vendor}?limit=${encodeURIComponent(String(limit))}`,
    {
      headers: {
        accept: "application/json",
        "x-api-key": key,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Public deals ${vendor} GET failed (${response.status}): ${text}`);
  }

  const body = (await response.json()) as { data?: PublicDealRow[] | PublicDealRow | null };
  if (Array.isArray(body.data)) return body.data;
  return body.data ? [body.data] : [];
}

export async function listAllPublicDeals(limitPerVendor = 5000) {
  const chunks = await Promise.all(
    PUBLIC_DEAL_VENDORS.map((vendor) => listPublicDeals(vendor, limitPerVendor)),
  );
  return chunks.flat();
}

export async function patchPublicDeal(
  vendor: PublicDealVendor,
  id: string,
  payload: PublicDealPayload,
) {
  const key = publicDealsApiKey();
  if (!key) {
    throw new Error("Missing PUBLIC_DEALS_API_KEY or DATA_HUB_API_KEY");
  }

  const response = await fetch(
    `${publicDealsBaseUrl()}/${vendor}?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string; detail?: string };
      message = [json.error, json.detail].filter(Boolean).join(": ") || text;
    } catch {
      // Keep the raw text.
    }
    throw new Error(`Public deals ${vendor} PATCH failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<unknown>;
}

export async function deletePublicDeal(vendor: PublicDealVendor, id: string) {
  const key = publicDealsApiKey();
  if (!key) {
    throw new Error("Missing PUBLIC_DEALS_API_KEY or DATA_HUB_API_KEY");
  }

  const response = await fetch(
    `${publicDealsBaseUrl()}/${vendor}?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        accept: "application/json",
        "x-api-key": key,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string; detail?: string };
      message = [json.error, json.detail].filter(Boolean).join(": ") || text;
    } catch {
      // Keep the raw text.
    }
    throw new Error(`Public deals ${vendor} DELETE failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<unknown>;
}
