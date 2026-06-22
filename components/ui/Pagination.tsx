"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PAGE_SIZES = [25, 50, 100];

export default function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) params.set(k, v);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  const goTo = (p: number) => pushParams({ page: String(Math.min(Math.max(1, p), totalPages)) });
  const changeSize = (size: number) => pushParams({ pageSize: String(size), page: "1" });

  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  // Window of up to 5 page numbers centered on the current page.
  const windowSize = 5;
  let startPage = Math.max(1, current - Math.floor(windowSize / 2));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);
  const pages: number[] = [];
  for (let p = startPage; p <= endPage; p++) pages.push(p);

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        {start}-{end} of {total.toLocaleString()} items
      </span>

      <div className="flex items-center gap-1.5">
        <button className={btn} onClick={() => goTo(1)} disabled={isPending || current <= 1} aria-label="First page">«</button>
        <button className={btn} onClick={() => goTo(current - 1)} disabled={isPending || current <= 1} aria-label="Previous page">‹</button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => goTo(p)}
            disabled={isPending}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm ${
              p === current
                ? "border-cyan-500 bg-cyan-50 font-semibold text-cyan-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p}
          </button>
        ))}
        <button className={btn} onClick={() => goTo(current + 1)} disabled={isPending || current >= totalPages} aria-label="Next page">›</button>
        <button className={btn} onClick={() => goTo(totalPages)} disabled={isPending || current >= totalPages} aria-label="Last page">»</button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => changeSize(Number(e.target.value))}
          disabled={isPending}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span>Items per page</span>
        {isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600" />
            Loading...
          </span>
        )}
      </div>
    </div>
  );
}
