// Links `projects` rows to Sequifi sales.
//
// Link priority: existing sequifi_sale_id -> project_id == pid -> normalized
// customer name. Names that map to more than one sale are flagged ambiguous and
// never auto-linked (avoids corrupting a record on a coincidental name clash).

import type { SequifiSale } from "./client";

export function normalizeName(s: string | null | undefined): string {
  // Strip address suffix: "Satpal Virk - 10119 Azinger Way" → "Satpal Virk"
  const stripped = (s ?? "").split(" - ")[0] ?? "";
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SalesIndex = {
  byPid: Map<string, SequifiSale>;
  byName: Map<string, SequifiSale>;
  ambiguousNames: Set<string>;
};

export function buildSalesIndex(sales: SequifiSale[]): SalesIndex {
  const byPid = new Map<string, SequifiSale>();
  const byName = new Map<string, SequifiSale>();
  const ambiguousNames = new Set<string>();

  for (const sale of sales) {
    if (sale.pid) byPid.set(sale.pid, sale);

    const name = normalizeName(sale.customer_name);
    if (!name) continue;
    if (byName.has(name)) {
      ambiguousNames.add(name);
    } else {
      byName.set(name, sale);
    }
  }

  return { byPid, byName, ambiguousNames };
}

export type ProjectForMatch = {
  id: string;
  project_id: string | null;
  opportunity_name: string | null;
  sequifi_sale_id: string | null;
};

export type MatchedBy = "sale_id" | "pid" | "name";

export type MatchOutcome =
  | { kind: "matched"; sale: SequifiSale; matchedBy: MatchedBy }
  | { kind: "ambiguous"; name: string }
  | { kind: "none" };

export function matchProjectToSale(
  project: ProjectForMatch,
  index: SalesIndex
): MatchOutcome {
  const existing = project.sequifi_sale_id?.trim();
  if (existing) {
    const sale = index.byPid.get(existing);
    if (sale) return { kind: "matched", sale, matchedBy: "sale_id" };
  }

  const pid = project.project_id?.trim();
  if (pid) {
    const sale = index.byPid.get(pid);
    if (sale) return { kind: "matched", sale, matchedBy: "pid" };
  }

  const name = normalizeName(project.opportunity_name);
  if (name) {
    if (index.ambiguousNames.has(name)) return { kind: "ambiguous", name };
    const sale = index.byName.get(name);
    if (sale) return { kind: "matched", sale, matchedBy: "name" };
  }

  return { kind: "none" };
}

export function repName(detail: SequifiSale["closer1"]): string | null {
  if (!detail) return null;
  const full = [detail.first_name, detail.last_name].filter(Boolean).join(" ").trim();
  return full || null;
}
