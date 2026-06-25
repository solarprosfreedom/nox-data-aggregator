"use client";

import { useEffect, useState } from "react";
import {
  useProjectFilterParam,
  useProjectFilterValues,
} from "./useProjectFilterParam";

type Props = {
  setters: string[];
  salesReps: string[];
  statuses: string[];
};

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
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
    </label>
  );
}

export default function PeopleStatusFilters({ setters, salesReps, statuses }: Props) {
  const { setter, salesRep, status, activeCount } = useProjectFilterValues();
  const { setValue: setSetter } = useProjectFilterParam("setter");
  const { setValue: setSalesRep } = useProjectFilterParam("salesRep");
  const { setValue: setStatus } = useProjectFilterParam("status");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (activeCount > 0) setExpanded(true);
  }, [activeCount]);

  useEffect(() => {
    if (activeCount === 0) setExpanded(false);
  }, [activeCount]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="people-status-filters-panel"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className="text-slate-500"
        >
          <path
            d="M1.5 2.5h11l-3.5 4v4l-4 1.5V6.5L1.5 2.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700">
            {activeCount}
          </span>
        )}
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
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
      </button>

      {expanded && (
        <section
          id="people-status-filters-panel"
          className="absolute right-0 top-full z-40 mt-2 w-[min(100vw-2rem,720px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
            <p className="mt-1 text-xs text-slate-500">
              Narrow projects by setter, sales rep, and stage.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <FilterSelect
              id="setter-filter"
              label="Filter by Setter"
              value={setter}
              options={setters}
              onChange={setSetter}
            />
            <FilterSelect
              id="sales-rep-filter"
              label="Filter by Sales Rep"
              value={salesRep}
              options={salesReps}
              onChange={setSalesRep}
            />
            <FilterSelect
              id="status-filter"
              label="Filter by Stage"
              value={status}
              options={statuses}
              onChange={setStatus}
            />
          </div>
        </section>
      )}
    </div>
  );
}
