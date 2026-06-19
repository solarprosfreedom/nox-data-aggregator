// Matches `projects` rows against locally-synced `terros_accounts` rows.
// terros_accounts holds Terros data already extracted into flat columns
// (setter_name = Terros owner, closer_name = Terros closer) plus the raw payload.

// ── Normalization helpers ─────────────────────────────────────────────────────

const STREET_SUFFIXES: Record<string, string> = {
  dr: "drive", st: "street", ave: "avenue", blvd: "boulevard",
  ln: "lane", rd: "road", ct: "court", pl: "place", hwy: "highway",
  pkwy: "parkway", cir: "circle", ter: "terrace", trl: "trail",
  fwy: "freeway", expy: "expressway", aly: "alley", bnd: "bend",
  brg: "bridge", cmn: "common", crk: "creek", xing: "crossing",
  n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
};

export function normalizePhone(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\D/g, "").slice(-10);
}

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

export function normalizeAddress(s: string | null | undefined): string {
  if (!s) return "";
  const words = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  // Expand suffix abbreviations (only when they appear as standalone words)
  return words.map((w) => STREET_SUFFIXES[w] ?? w).join(" ");
}

export function normalizeZip(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").slice(0, 5);
}

// ── terros_accounts row shape ────────────────────────────────────────────────

export type TerrosAccountRow = {
  account_id: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  postal_code: string | null;
  setter_name: string | null;
  setter_email: string | null;
  closer_name: string | null;
  raw_terros: unknown;
};

export type MatchedBy = "email" | "phone" | "address";

export type MatchResult = {
  account: TerrosAccountRow;
  matchedBy: MatchedBy;
};

export type TerrosIndex = {
  byEmail: Map<string, TerrosAccountRow>;
  byPhone: Map<string, TerrosAccountRow>;
  // key = normAddress + "|" + zip  (no name — names are mostly absent in Terros data)
  byAddrZip: Map<string, TerrosAccountRow>;
};

export function buildIndex(accounts: TerrosAccountRow[]): TerrosIndex {
  const byEmail = new Map<string, TerrosAccountRow>();
  const byPhone = new Map<string, TerrosAccountRow>();
  const byAddrZip = new Map<string, TerrosAccountRow>();

  for (const a of accounts) {
    const email = normalizeEmail(a.email);
    if (email && !byEmail.has(email)) byEmail.set(email, a);

    const phone = normalizePhone(a.phone);
    if (phone.length >= 10 && !byPhone.has(phone)) byPhone.set(phone, a);

    const addr = normalizeAddress(a.address_line1);
    const zip = normalizeZip(a.postal_code);
    if (addr && zip) {
      const key = `${addr}|${zip}`;
      if (!byAddrZip.has(key)) byAddrZip.set(key, a);
    }
  }

  return { byEmail, byPhone, byAddrZip };
}

// ── Project matcher ───────────────────────────────────────────────────────────

export type ProjectRecord = {
  id: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  postal_code: string | null;
};

// Cascading OR: email → phone → address+zip (last resort). Address never
// overrides an email/phone hit, so a mismatched address can't corrupt a match.
export function matchProject(
  project: ProjectRecord,
  index: TerrosIndex
): MatchResult | null {
  const email = normalizeEmail(project.email);
  if (email) {
    const a = index.byEmail.get(email);
    if (a) return { account: a, matchedBy: "email" };
  }

  const phone = normalizePhone(project.phone);
  if (phone.length >= 10) {
    const a = index.byPhone.get(phone);
    if (a) return { account: a, matchedBy: "phone" };
  }

  const addr = normalizeAddress(project.address_line1);
  const zip = normalizeZip(project.postal_code);
  if (addr && zip) {
    const a = index.byAddrZip.get(`${addr}|${zip}`);
    if (a) return { account: a, matchedBy: "address" };
  }

  return null;
}

// Pull the owner (setter) email out of the raw Terros payload, when present.
export function ownerEmailFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const owner = (raw as Record<string, unknown>).owner;
  if (!owner || typeof owner !== "object") return null;
  const email = (owner as Record<string, unknown>).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

// Pull the closer email out of the raw Terros payload, when present.
export function closerEmailFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const closer = (raw as Record<string, unknown>).closer;
  if (!closer || typeof closer !== "object") return null;
  const email = (closer as Record<string, unknown>).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}
