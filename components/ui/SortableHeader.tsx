"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ProjectSortColumn } from "@/lib/data-hub/project-sort";

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

export default function SortableHeader({
  label,
  column,
  currentSort,
  currentDir,
}: {
  label: string;
  column: ProjectSortColumn;
  currentSort: ProjectSortColumn;
  currentDir: "asc" | "desc";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  const active = currentSort === column;
  const displayDir = active ? currentDir : "desc";

  useEffect(() => {
    setPending(false);
  }, [currentSort, currentDir, searchParams]);

  const href = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (active) {
      params.set("sortDir", currentDir === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", column);
      params.set("sortDir", "asc");
    }
    params.set("page", "1");
    return `${pathname}?${params.toString()}`;
  }, [active, column, currentDir, pathname, searchParams]);

  return (
    <th className="whitespace-nowrap border-b border-slate-200 bg-white px-3 py-3 text-left text-xs font-normal text-slate-600">
      <Link
        href={href()}
        replace
        scroll={false}
        prefetch
        title={`Sort by ${label}`}
        aria-sort={
          active ? (currentDir === "asc" ? "ascending" : "descending") : "none"
        }
        onClick={() => setPending(true)}
        className={`group inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-slate-900 ${
          active || pending ? "text-slate-900" : "text-slate-600"
        } ${pending ? "opacity-70" : ""}`}
      >
        <span>{label}</span>
        <SortCaret direction={displayDir} active={active} />
      </Link>
    </th>
  );
}
