"use client";

import { formatSystemSize } from "@/lib/data-hub/system-size-display";
import { useSystemSizeUnit } from "@/app/(dashboard)/projects/SystemSizeUnitContext";

export default function SystemSizeCell({
  kw,
}: {
  kw: number | null | undefined;
}) {
  const { unit, ready } = useSystemSizeUnit();
  const display = formatSystemSize(kw, unit);

  if (!ready && kw != null) {
    const fallback = formatSystemSize(kw, "w");
    return <>{fallback ?? <span className="text-slate-300">—</span>}</>;
  }

  if (display == null) {
    return <span className="text-slate-300">—</span>;
  }

  return <>{display}</>;
}
