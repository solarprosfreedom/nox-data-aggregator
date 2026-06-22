"use client";

import { useProjectsPager } from "@/app/(dashboard)/projects/useProjectsPager";

const PAGE_SIZES = [25, 50, 100];

export default function Pagination({ total }: { total: number }) {
  const { displayPage, displayPageSize, goToPage, changePageSize, isNavigating } =
    useProjectsPager();

  const totalPages = Math.max(1, Math.ceil(total / displayPageSize));
  const activePage = Math.min(Math.max(1, displayPage), totalPages);

  const start = total === 0 ? 0 : (activePage - 1) * displayPageSize + 1;
  const end = Math.min(activePage * displayPageSize, total);

  const windowSize = 5;
  let startPage = Math.max(1, activePage - Math.floor(windowSize / 2));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);
  const pages: number[] = [];
  for (let p = startPage; p <= endPage; p++) pages.push(p);

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform";
  const pageBtn = (p: number, isActive: boolean) =>
    `flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-all active:scale-95 ${
      isActive
        ? "border-cyan-500 bg-cyan-50 font-semibold text-cyan-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span className="inline-flex items-center gap-2">
        <span className={isNavigating ? "text-slate-400" : undefined}>
          {start}-{end} of {total.toLocaleString()} items
        </span>
      </span>

      <div className="flex items-center gap-1.5">
        <PagerBtn
          className={btn}
          disabled={activePage <= 1}
          aria-label="First page"
          onGo={() => goToPage(1)}
        >
          «
        </PagerBtn>
        <PagerBtn
          className={btn}
          disabled={activePage <= 1}
          aria-label="Previous page"
          onGo={() => goToPage(Math.max(1, activePage - 1))}
        >
          ‹
        </PagerBtn>
        {pages.map((p) => (
          <PagerBtn
            key={p}
            className={pageBtn(p, p === activePage)}
            aria-label={`Page ${p}`}
            aria-current={p === activePage ? "page" : undefined}
            onGo={() => goToPage(p)}
          >
            {p}
          </PagerBtn>
        ))}
        <PagerBtn
          className={btn}
          disabled={activePage >= totalPages}
          aria-label="Next page"
          onGo={() => goToPage(Math.min(totalPages, activePage + 1))}
        >
          ›
        </PagerBtn>
        <PagerBtn
          className={btn}
          disabled={activePage >= totalPages}
          aria-label="Last page"
          onGo={() => goToPage(totalPages)}
        >
          »
        </PagerBtn>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={displayPageSize}
          onChange={(e) => changePageSize(Number(e.target.value))}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span>Items per page</span>
      </div>
    </div>
  );
}

function PagerBtn({
  children,
  className,
  disabled,
  onGo,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
}: {
  children: React.ReactNode;
  className: string;
  disabled?: boolean;
  onGo: () => void;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      disabled={disabled}
      className={`${className}${disabled ? " cursor-not-allowed opacity-40" : ""}`}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault();
        onGo();
      }}
    >
      {children}
    </button>
  );
}
