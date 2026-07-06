"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  useProjectFilterParam,
  type ProjectFilterParamKey,
} from "@/app/(dashboard)/projects/useProjectFilterParam";

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`shrink-0 transition-colors ${
        active ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
      }`}
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

export default function ColumnFilterPopover({
  paramKey,
  options,
  ariaLabel,
}: {
  paramKey: ProjectFilterParamKey;
  options: string[];
  ariaLabel: string;
}) {
  const selectId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const { value, setValue } = useProjectFilterParam(paramKey);
  const active = value.length > 0;

  function updatePanelPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = 220;
    const left = Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8));
    setPanelStyle({ top: rect.bottom + 4, left });
  }

  function openPanel() {
    updatePanelPosition();
    setOpen(true);
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

  return (
    <>
      <span className="relative inline-flex">
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          title={active ? `Filtered: ${value}` : ariaLabel}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((prev) => {
              if (prev) return false;
              openPanel();
              return true;
            });
          }}
          onMouseDown={(event) => event.stopPropagation()}
          className={`group inline-flex shrink-0 cursor-pointer items-center rounded p-0.5 transition-colors hover:bg-orange-50 ${
            active ? "bg-orange-50 text-orange-600 ring-1 ring-orange-200" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <FilterIcon active={active} />
        </button>
        {active && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden />
        )}
      </span>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel}
          className="fixed z-[100] w-[220px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          style={{ top: panelStyle.top, left: panelStyle.left }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <label htmlFor={selectId} className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {ariaLabel}
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={value}
              autoFocus
              onChange={(event) => {
                setValue(event.target.value);
                setOpen(false);
              }}
              className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">All</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}
