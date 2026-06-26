"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ProjectSortColumn } from "@/lib/data-hub/project-sort";
import ColumnAdvancedFilter from "./ColumnAdvancedFilter";
import { useProjectsPagerOptional } from "@/app/(dashboard)/projects/useProjectsPager";
import { useSystemSizeUnit } from "@/app/(dashboard)/projects/SystemSizeUnitContext";
import type { SystemSizeUnit } from "@/lib/data-hub/system-size-display";

function SortCaret({
  direction,
  active,
}: {
  direction: "asc" | "desc";
  active: boolean;
}) {
  const up = direction === "asc";
  return (
    <svg
      width="8"
      height="5"
      viewBox="0 0 8 5"
      fill="currentColor"
      aria-hidden
      className={`shrink-0 transition-colors ${
        active ? "text-slate-800" : "text-slate-300 group-hover:text-slate-400"
      } ${up ? "rotate-180" : ""}`}
    >
      <path d="M4 5L0 0h8L4 5z" />
    </svg>
  );
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: SystemSizeUnit;
  onChange: (unit: SystemSizeUnit) => void;
}) {
  return (
    <span
      className="ml-1 inline-flex overflow-hidden rounded border border-slate-200 bg-slate-50 text-[10px] font-medium leading-none"
      role="group"
      aria-label="System size unit"
    >
      {(["kw", "w"] as const).map((value) => {
        const active = unit === value;
        const label = value === "kw" ? "kW" : "W";
        return (
          <button
            key={value}
            type="button"
            title={`Show system size in ${label}`}
            aria-pressed={active}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange(value);
            }}
            className={`px-1.5 py-1 transition-colors ${
              active
                ? "bg-cyan-600 text-white"
                : "text-slate-500 hover:bg-white hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}

export default function SystemSizeColumnHeader({
  column,
  currentSort,
  currentDir,
}: {
  column: ProjectSortColumn;
  currentSort: ProjectSortColumn;
  currentDir: "asc" | "desc";
}) {
  const searchParams = useSearchParams();
  const pager = useProjectsPagerOptional();
  const { unit, setUnit } = useSystemSizeUnit();
  const [pending, setPending] = useState(false);

  const active = currentSort === column;
  const displayDir = active ? currentDir : "desc";

  useEffect(() => {
    setPending(false);
  }, [currentSort, currentDir, searchParams]);

  function onSort(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!pager) return;
    setPending(true);
    pager.replaceSearchParams((params) => {
      if (active) {
        params.set("sortDir", currentDir === "asc" ? "desc" : "asc");
      } else {
        params.set("sort", column);
        params.set("sortDir", "asc");
      }
      params.set("page", "1");
    });
  }

  return (
    <th className="whitespace-nowrap border-b border-slate-200 bg-white px-3 py-3 text-left text-xs font-normal text-slate-600">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          title="Sort by system size"
          aria-sort={
            active ? (currentDir === "asc" ? "ascending" : "descending") : "none"
          }
          onClick={onSort}
          className={`group inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 transition-colors hover:text-slate-900 ${
            active || pending ? "text-slate-900" : "text-slate-600"
          } ${pending ? "opacity-70" : ""}`}
        >
          <span>System Size</span>
          <SortCaret direction={displayDir} active={active} />
        </button>
        <UnitToggle unit={unit} onChange={setUnit} />
        <ColumnAdvancedFilter columnId="system_size_kw" label="System Size" />
      </div>
    </th>
  );
}
