"use client";

import { formatSystemSize } from "@/lib/data-hub/system-size-display";
import { useSystemSizeUnit } from "@/app/(dashboard)/projects/SystemSizeUnitContext";

export default function SystemSizeDisplay({
  kw,
  fallback = "—",
}: {
  kw: number | null | undefined;
  fallback?: string;
}) {
  const { unit, ready } = useSystemSizeUnit();
  const display = formatSystemSize(kw, ready ? unit : "w");

  return <>{display ?? fallback}</>;
}
