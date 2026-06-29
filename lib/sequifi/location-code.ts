/** Sequifi location_code = "{STATE}.{InstallerCode}" derived from projects.installer */

const CORP_SUFFIX =
  /\s+(solar corp|solar|corp|corporation|llc|inc|co\.?)\.?$/i;

/** Short code from projects.installer (e.g. "Axia Solar Corp" → "Axia"). */
export function sequifiInstallerCode(
  installer: string | null | undefined,
): string {
  const raw = installer?.trim();
  if (!raw) return "Unknown";

  let name = raw;
  let prev = "";
  while (name !== prev) {
    prev = name;
    name = name.replace(CORP_SUFFIX, "").trim();
  }
  if (!name) name = raw;

  const firstToken = name.split(/\s+/)[0] ?? name;
  const cleaned = firstToken.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleaned) return "Unknown";

  if (/^[A-Z0-9]{2,6}$/.test(cleaned)) return cleaned;

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

export function sequifiLocationCode(
  state: string,
  installer: string | null | undefined,
): string {
  const st = state.trim().toUpperCase();
  return `${st}.${sequifiInstallerCode(installer)}`;
}
