const PROJECTS_TABLE_QUERY_PARAMS = [
  "q",
  "page",
  "pageSize",
  "sort",
  "sortDir",
  "installer",
  "setter",
  "salesRep",
  "status",
] as const;

export function isProjectsTableQueryParam(key: string): boolean {
  return (
    key.startsWith("cf_") ||
    (PROJECTS_TABLE_QUERY_PARAMS as readonly string[]).includes(key)
  );
}

export function searchParamsFromPageParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!isProjectsTableQueryParam(k)) continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item) sp.append(k, item);
    } else if (v) {
      sp.set(k, v);
    }
  }
  return sp;
}

function readNormalizedState(searchParams: URLSearchParams) {
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [25, 50, 100].includes(Number(searchParams.get("pageSize")))
      ? Number(searchParams.get("pageSize"))
      : 25,
    sort: searchParams.get("sort") ?? "updated_at",
    sortDir: searchParams.get("sortDir") ?? "desc",
    q: searchParams.get("q") ?? "",
    installer: searchParams.get("installer") ?? "",
    setter: searchParams.get("setter") ?? "",
    salesRep: searchParams.get("salesRep") ?? "",
    status: searchParams.get("status") ?? "",
  };
}

function columnFilterParts(searchParams: URLSearchParams): string[] {
  const keys = [...new Set([...searchParams.keys()])]
    .filter((k) => k.startsWith("cf_"))
    .sort();
  const parts: string[] = [];
  for (const k of keys) {
    for (const v of searchParams.getAll(k).sort()) {
      parts.push(`${k}=${v}`);
    }
  }
  return parts;
}

/** Canonical key for comparing client URL state with server-rendered query. */
export function projectsTableQueryKey(searchParams: URLSearchParams): string {
  const s = readNormalizedState(searchParams);
  const base = [
    s.page,
    s.pageSize,
    s.sort,
    s.sortDir,
    s.q,
    s.installer,
    s.setter,
    s.salesRep,
    s.status,
  ].join("|");
  const cf = columnFilterParts(searchParams).join("&");
  return cf ? `${base}|${cf}` : base;
}
