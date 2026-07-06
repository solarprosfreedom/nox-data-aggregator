"use client";

import { useMemo, useState } from "react";

type FilterOption = {
  value: string;
  label: string;
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
  options: FilterOption[];
  onChange: (value: string) => void;
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
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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

export default function SyncFilters() {
  const setterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "All setters" },
      { value: "ashley-johnson", label: "Ashley Johnson" },
      { value: "chris-gibson", label: "Chris Gibson" },
      { value: "daniel-moore", label: "Daniel Moore" },
    ],
    [],
  );

  const salesRepOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "All sales reps" },
      { value: "jared-carter", label: "Jared Carter" },
      { value: "stephanie-cole", label: "Stephanie Cole" },
      { value: "justin-hayes", label: "Justin Hayes" },
    ],
    [],
  );

  const statusOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "All statuses" },
      { value: "matched", label: "Matched" },
      { value: "pending", label: "Pending" },
      { value: "needs-review", label: "Needs review" },
    ],
    [],
  );

  const [setter, setSetter] = useState("all");
  const [salesRep, setSalesRep] = useState("all");
  const [status, setStatus] = useState("all");

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Filter Sync Results</h2>
        <p className="mt-1 text-xs text-slate-500">
          Narrow sync records by setter, sales rep, and current status.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <FilterSelect
          id="setter-filter"
          label="Filter by Setter"
          value={setter}
          options={setterOptions}
          onChange={setSetter}
        />
        <FilterSelect
          id="sales-rep-filter"
          label="Filter by Sales Rep"
          value={salesRep}
          options={salesRepOptions}
          onChange={setSalesRep}
        />
        <FilterSelect
          id="status-filter"
          label="Filter by Stage"
          value={status}
          options={statusOptions}
          onChange={setStatus}
        />
      </div>
    </section>
  );
}
