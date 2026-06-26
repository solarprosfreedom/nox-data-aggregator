export type SystemSizeUnit = "kw" | "w";

export const SYSTEM_SIZE_UNIT_STORAGE_KEY = "nox-projects-system-size-unit";

export function parseSystemSizeUnit(raw: string | null | undefined): SystemSizeUnit {
  return raw === "kw" ? "kw" : "w";
}

export function formatSystemSize(
  kw: number | null | undefined,
  unit: SystemSizeUnit,
): string | null {
  if (kw == null) return null;
  const n = Number(kw);
  if (isNaN(n)) return null;

  if (unit === "kw") {
    return `${n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} kW`;
  }

  return `${Math.round(n * 1000).toLocaleString("en-US")} W`;
}
