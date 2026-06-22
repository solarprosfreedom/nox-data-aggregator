"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const active = currentSort === column;
  const displayDir = active ? currentDir : "desc";

  const onClick = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (active) {
      params.set("sortDir", currentDir === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", column);
      params.set("sortDir", "asc");
    }
    params.set("page", "1");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [active, column, currentDir, pathname, router, searchParams]);

  return (
    <th className="whitespace-nowrap border-b border-slate-200 bg-white px-3 py-3 text-left text-xs font-normal text-slate-600">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        title={`Sort by ${label}`}
        aria-sort={
          active ? (currentDir === "asc" ? "ascending" : "descending") : "none"
        }
        className={`group inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-slate-900 disabled:opacity-50 ${
          active ? "text-slate-900" : "text-slate-600"
        }`}
      >
        <span>{label}</span>
        <SortCaret direction={displayDir} active={active} />
      </button>
    </th>
  );
}
