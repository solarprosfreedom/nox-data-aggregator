"use client";

import { useSearchParams } from "next/navigation";
import { IconBuilding, IconChevronDown } from "@/components/ui/icons";
import { useProjectsPager } from "./useProjectsPager";

export default function InstallerFilter({
  installers,
}: {
  installers: string[];
}) {
  const searchParams = useSearchParams();
  const { replaceSearchParams } = useProjectsPager();
  const current = searchParams.get("installer") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    replaceSearchParams((params) => {
      if (next) params.set("installer", next);
      else params.delete("installer");
      params.delete("page");
    });
  }

  return (
    <div className="relative">
      <IconBuilding
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <select
        value={current}
        onChange={onChange}
        className="h-10 min-w-[10rem] appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        aria-label="Filter by installer"
      >
        <option value="">All installers</option>
        {installers.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
