"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function InstallerFilter({
  installers,
}: {
  installers: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("installer") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("installer", next);
    else params.delete("installer");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="relative">
      <select
        value={current}
        onChange={onChange}
        className="h-10 appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        aria-label="Filter by installer"
      >
        <option value="">All sources</option>
        {installers.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
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
  );
}
