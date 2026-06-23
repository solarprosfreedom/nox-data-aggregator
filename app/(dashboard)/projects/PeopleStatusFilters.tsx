"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setter = searchParams.get("setter") ?? "";
  const salesRep = searchParams.get("salesRep") ?? "";
  const status = searchParams.get("status") ?? "";

  function updateParam(key: "setter" | "salesRep" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <p className="mt-1 text-xs text-slate-500">
          Narrow projects by setter, sales rep, and status.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <FilterSelect
          id="setter-filter"
          label="Filter by Setter"
          value={setter}
          options={setters}
          onChange={(next) => updateParam("setter", next)}
        />
        <FilterSelect
          id="sales-rep-filter"
          label="Filter by Sales Rep"
          value={salesRep}
          options={salesReps}
          onChange={(next) => updateParam("salesRep", next)}
        />
        <FilterSelect
          id="status-filter"
          label="Filter by Stage"
          value={status}
          options={statuses}
          onChange={(next) => updateParam("status", next)}
        />
      </div>
    </section>
  );
}
