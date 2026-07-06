"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  columnFilterParamKey,
  decodeMultiSelectFilter,
  encodeMultiSelectFilter,
} from "@/lib/data-hub/column-filters";
import { useProjectsPagerOptional } from "@/app/(dashboard)/projects/useProjectsPager";

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`shrink-0 ${active ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"}`}
    >
      <path
        d="M1.5 2.5h11l-3.5 4v4l-4 1.5V6.5L1.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ColumnCheckboxFilter({
  columnId,
  label,
  options,
}: {
  columnId: string;
  label: string;
  options: string[];
}) {
  const paramKey = columnFilterParamKey(columnId);
  const searchParams = useSearchParams();
  const pager = useProjectsPagerOptional();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const raw = searchParams.get(paramKey) ?? "";
  const activeValues = decodeMultiSelectFilter(raw) ?? [];
  const active = activeValues.length > 0;

  useEffect(() => {
    if (open) setDraft(new Set(activeValues));
  }, [open, raw]);

  function updatePanelPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = 260;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - panelWidth - 8)
    );
    setPanelStyle({ top: rect.bottom + 4, left });
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onScrollOrResize() {
      updatePanelPosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const allSelected = options.length > 0 && draft.size === options.length;
  const someSelected = draft.size > 0 && draft.size < options.length;

  function toggleAll() {
    setDraft(allSelected ? new Set() : new Set(options));
  }

  function toggleOne(name: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function applyFilter() {
    pager?.replaceSearchParams((params) => {
      const selected = [...draft];
      if (selected.length > 0) {
        params.set(paramKey, encodeMultiSelectFilter(selected));
      } else {
        params.delete(paramKey);
      }
      params.delete("page");
      params.delete("setter");
      params.delete("salesRep");
    });
    setOpen(false);
  }

  function clearFilter() {
    pager?.replaceSearchParams((params) => {
      params.delete(paramKey);
      params.delete("page");
      params.delete("setter");
      params.delete("salesRep");
    });
    setDraft(new Set());
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Filter ${label}`}
        aria-expanded={open}
        title={active ? `${activeValues.length} selected` : `Filter ${label}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) setOpen(false);
          else {
            updatePanelPosition();
            setOpen(true);
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
        className={`group relative inline-flex shrink-0 cursor-pointer items-center rounded p-0.5 transition-colors hover:bg-orange-50 ${
          active
            ? "bg-orange-50 text-orange-600 ring-1 ring-orange-200"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <FilterIcon active={active} />
        {active && (
          <span
            className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-500"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Filter ${label}`}
          className="fixed z-[100] flex w-[260px] flex-col rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{ top: panelStyle.top, left: panelStyle.left }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="max-h-56 overflow-y-auto border-b border-slate-100 p-2">
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-slate-800">Select All</span>
            </label>
            {options.map((name) => (
              <label
                key={name}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={draft.has(name)}
                  onChange={() => toggleOne(name)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="truncate text-sm text-slate-700">{name}</span>
              </label>
            ))}
            {options.length === 0 && (
              <p className="px-2 py-3 text-sm text-slate-400">No values available</p>
            )}
          </div>

          <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            {draft.size} item{draft.size === 1 ? "" : "s"} selected
          </p>

          <div className="flex gap-2 p-3">
            <button
              type="button"
              onClick={applyFilter}
              className="flex-1 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={clearFilter}
              className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
