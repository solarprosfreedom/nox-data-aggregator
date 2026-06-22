"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProjectSortColumn } from "@/lib/data-hub/project-sort";

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
  const arrow = active ? (currentDir === "asc" ? " ↑" : " ↓") : "";

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
    <th className="whitespace-nowrap px-3 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wide transition-colors hover:text-cyan-700 disabled:opacity-50 ${
          active ? "text-cyan-700" : "text-slate-500"
        }`}
      >
        {label}
        <span className="text-[10px] font-normal normal-case">{arrow}</span>
      </button>
    </th>
  );
}
