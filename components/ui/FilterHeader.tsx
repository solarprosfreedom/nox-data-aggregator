"use client";

import type { ProjectFilterParamKey } from "@/app/(dashboard)/projects/useProjectFilterParam";
import ColumnFilterPopover from "./ColumnFilterPopover";

export default function FilterHeader({
  label,
  filterParamKey,
  filterOptions,
  filterAriaLabel,
}: {
  label: string;
  filterParamKey: ProjectFilterParamKey;
  filterOptions: string[];
  filterAriaLabel: string;
}) {
  return (
    <th className="whitespace-nowrap border-b border-slate-200 bg-white px-3 py-3 text-left text-xs font-normal text-slate-600">
      <div className="inline-flex items-center gap-1">
        <span>{label}</span>
        <ColumnFilterPopover
          paramKey={filterParamKey}
          options={filterOptions}
          ariaLabel={filterAriaLabel}
        />
      </div>
    </th>
  );
}
