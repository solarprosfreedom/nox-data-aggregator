/** Supported public-deals vendors, merged with distinct installer names from the endpoints. */
export const KNOWN_INSTALLERS = [
  "Axia",
  "Illum",
  "Tron",
  "Empwr",
  "GoodPwr",
  "OWE",
] as const;

export function mergeInstallerOptions(fromDb: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const name of KNOWN_INSTALLERS) {
    byKey.set(name.toLowerCase(), name);
  }
  for (const name of fromDb) {
    const trimmed = name.trim();
    if (trimmed && !byKey.has(trimmed.toLowerCase())) {
      byKey.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
