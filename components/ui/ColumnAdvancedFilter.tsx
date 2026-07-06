"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FILTER_OPERATORS,
  columnFilterParamKey,
  decodeColumnFilter,
  encodeColumnFilter,
  isColumnFilterActive,
  type ColumnFilterState,
  type FilterOperator,
} from "@/lib/data-hub/column-filters";
import { useProjectsPagerOptional } from "@/app/(dashboard)/projects/useProjectsPager";

const EMPTY_FILTER: ColumnFilterState = {
  c1: { op: "eq", value: "" },
  logic: "and",
  c2: { op: "eq", value: "" },
};

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

function ConditionRow({
  id,
  condition,
  onChange,
}: {
  id: string;
  condition: { op: FilterOperator; value: string };
  onChange: (next: { op: FilterOperator; value: string }) => void;
}) {
  const hideValue =
    condition.op === "isempty" || condition.op === "isnotempty";

  return (
    <div className="flex gap-2">
      <select
        value={condition.op}
        onChange={(e) =>
          onChange({ ...condition, op: e.target.value as FilterOperator })
        }
        className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
      >
        {FILTER_OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {!hideValue && (
        <input
          id={id}
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value"
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        />
      )}
    </div>
  );
}

export default function ColumnAdvancedFilter({
  columnId,
  label,
}: {
  columnId: string;
  label: string;
}) {
  const paramKey = columnFilterParamKey(columnId);
  const searchParams = useSearchParams();
  const pager = useProjectsPagerOptional();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<ColumnFilterState>(EMPTY_FILTER);

  const raw = searchParams.get(paramKey) ?? "";
  const activeFilter = decodeColumnFilter(raw);
  const active = isColumnFilterActive(activeFilter ?? undefined);

  useEffect(() => {
    if (open) {
      setDraft(activeFilter ?? EMPTY_FILTER);
    }
  }, [open, raw]);

  function updatePanelPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = 320;
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

  function applyFilter() {
    pager?.replaceSearchParams((params) => {
      if (isColumnFilterActive(draft)) {
        params.set(paramKey, encodeColumnFilter(draft));
      } else {
        params.delete(paramKey);
      }
      params.delete("page");
    });
    setOpen(false);
  }

  function clearFilter() {
    pager?.replaceSearchParams((params) => {
      params.delete(paramKey);
      params.delete("page");
    });
    setDraft(EMPTY_FILTER);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Filter ${label}`}
        aria-expanded={open}
        title={active ? `Filtered: ${label}` : `Filter ${label}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
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
          className="fixed z-[100] w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
          style={{ top: panelStyle.top, left: panelStyle.left }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <p className="mb-3 text-sm font-medium text-slate-800">{label}</p>
          <p className="mb-2 text-xs text-slate-500">Show items with value that:</p>

          <ConditionRow
            id={`${columnId}-c1`}
            condition={draft.c1}
            onChange={(c1) => setDraft((prev) => ({ ...prev, c1 }))}
          />

          <div className="my-2 flex items-center gap-2">
            <select
              value={draft.logic}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  logic: e.target.value as "and" | "or",
                }))
              }
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="and">And</option>
              <option value="or">Or</option>
            </select>
          </div>

          <ConditionRow
            id={`${columnId}-c2`}
            condition={draft.c2 ?? { op: "eq", value: "" }}
            onChange={(c2) => setDraft((prev) => ({ ...prev, c2 }))}
          />

          <div className="mt-4 flex gap-2">
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
