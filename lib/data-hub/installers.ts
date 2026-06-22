/** Common installers; merged with distinct values from the database. */
export const KNOWN_INSTALLERS = [
  "Axia Solar Corp",
  "Illum",
  "OWE",
  "Tron",
  "Sunergy",
  "LGCY",
] as const;

export function mergeInstallerOptions(fromDb: string[]): string[] {
  const set = new Set<string>(KNOWN_INSTALLERS);
  for (const name of fromDb) {
    const trimmed = name.trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
