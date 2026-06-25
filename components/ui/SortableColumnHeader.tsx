"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ProjectSortColumn } from "@/lib/data-hub/project-sort";
import ColumnAdvancedFilter from "./ColumnAdvancedFilter";
import ColumnCheckboxFilter from "./ColumnCheckboxFilter";
import { useProjectsPagerOptional } from "@/app/(dashboard)/projects/useProjectsPager";

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

export default function SortableColumnHeader({
  label,
  column,
  filterColumnId,
  checkboxOptions,
  currentSort,
  currentDir,
}: {
  label: string;
  column: ProjectSortColumn;
  filterColumnId?: string;
  checkboxOptions?: string[];
  currentSort: ProjectSortColumn;
  currentDir: "asc" | "desc";
}) {
  const searchParams = useSearchParams();
  const pager = useProjectsPagerOptional();
  const [pending, setPending] = useState(false);
  const filterId = filterColumnId ?? column;

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
          title={`Sort by ${label}`}
          aria-sort={
            active ? (currentDir === "asc" ? "ascending" : "descending") : "none"
          }
          onClick={onSort}
          className={`group inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 transition-colors hover:text-slate-900 ${
            active || pending ? "text-slate-900" : "text-slate-600"
          } ${pending ? "opacity-70" : ""}`}
        >
          <span>{label}</span>
          <SortCaret direction={displayDir} active={active} />
        </button>
        {checkboxOptions ? (
          <ColumnCheckboxFilter
            columnId={filterId}
            label={label}
            options={checkboxOptions}
          />
        ) : (
          <ColumnAdvancedFilter columnId={filterId} label={label} />
        )}
      </div>
    </th>
  );
}
