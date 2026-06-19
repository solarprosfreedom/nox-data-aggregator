export type TerrosAccount = {
  id: string;
  externalLeadId?: string | null;
  resident?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  address?: {
    line1?: string;
    locality?: string;
    countrySubd?: string;
    postal1?: string;
  };
  owner?: {
    id?: string;
    name?: string;
    email?: string;
  };
};

const BASE = (process.env.TERROS_API_BASE_URL ?? "https://api.terros.com").replace(/\/$/, "");
const KEY  = process.env.TERROS_API_KEY ?? "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
      "x-api-key": KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Terros ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

type ListResponse = {
  accounts?: TerrosAccount[];
  data?: TerrosAccount[];
  results?: TerrosAccount[];
  items?: TerrosAccount[];
  total?: number;
  totalCount?: number;
};

function extractAccounts(body: ListResponse): TerrosAccount[] {
  for (const key of ["accounts", "data", "results", "items"] as const) {
    const v = body[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

/**
 * Fetches ALL Terros accounts by paginating through /account/list.
 * Returns them as a flat array.
 */
export async function fetchAllTerrosAccounts(
  onProgress?: (fetched: number, total: number | null) => void
): Promise<TerrosAccount[]> {
  const PAGE_SIZE = 200;
  const all: TerrosAccount[] = [];
  let page = 1;
  let total: number | null = null;

  while (true) {
    const body = await post<ListResponse>("/account/list", {
      page,
      pageSize: PAGE_SIZE,
    });

    const accounts = extractAccounts(body);
    if (total === null) total = body.total ?? body.totalCount ?? null;

    all.push(...accounts);
    onProgress?.(all.length, total);

    if (accounts.length < PAGE_SIZE) break;
    page++;

    // Polite rate limit: 50ms between pages
    await new Promise((r) => setTimeout(r, 50));
  }

  return all;
}

export function terrosAccountName(a: TerrosAccount): string {
  return (
    a.resident?.name ||
    [a.resident?.firstName, a.resident?.lastName].filter(Boolean).join(" ") ||
    ""
  );
}
