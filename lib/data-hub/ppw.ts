/** Watts from kW; null when size is missing or zero. */
export function systemWatts(systemSizeKw: number | null | undefined): number | null {
  if (systemSizeKw == null) return null;
  const kw = Number(systemSizeKw);
  if (isNaN(kw) || kw <= 0) return null;
  return kw * 1000;
}

/** Gross PPW = total_system_cost / watts */
export function computeGrossPpw(
  totalSystemCost: number | null | undefined,
  systemSizeKw: number | null | undefined
): number | null {
  const watts = systemWatts(systemSizeKw);
  const cost = totalSystemCost == null ? null : Number(totalSystemCost);
  if (watts == null || cost == null || isNaN(cost)) return null;
  return cost / watts;
}

/** Net PPW = (total_system_cost - battery - adder) / watts */
export function computeNetPpw(
  totalSystemCost: number | null | undefined,
  systemSizeKw: number | null | undefined,
  batteryPrice: number | null | undefined,
  adderAmount: number | null | undefined
): number | null {
  const watts = systemWatts(systemSizeKw);
  const cost = totalSystemCost == null ? null : Number(totalSystemCost);
  if (watts == null || cost == null || isNaN(cost)) return null;
  const battery = batteryPrice == null ? 0 : Number(batteryPrice) || 0;
  const adder = adderAmount == null ? 0 : Number(adderAmount) || 0;
  return (cost - battery - adder) / watts;
}

export function formatPpw(value: number | null | undefined): string | null {
  if (value == null || isNaN(Number(value))) return null;
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
