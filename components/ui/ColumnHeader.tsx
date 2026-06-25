"use client";

import ColumnAdvancedFilter from "./ColumnAdvancedFilter";
import ColumnCheckboxFilter from "./ColumnCheckboxFilter";

export default function ColumnHeader({
  label,
  filterColumnId,
  checkboxOptions,
}: {
  label: string;
  filterColumnId: string;
  checkboxOptions?: string[];
}) {
  return (
    <th className="whitespace-nowrap border-b border-slate-200 bg-white px-3 py-3 text-left text-xs font-normal text-slate-600">
      <div className="inline-flex items-center gap-1">
        <span>{label}</span>
        {checkboxOptions ? (
          <ColumnCheckboxFilter
            columnId={filterColumnId}
            label={label}
            options={checkboxOptions}
          />
        ) : (
          <ColumnAdvancedFilter columnId={filterColumnId} label={label} />
        )}
      </div>
    </th>
  );
}
