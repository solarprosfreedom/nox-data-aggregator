"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ProjectsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (val) params.set("q", val);
      else params.delete("q");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
  }

  return (
    <div className="relative">
      <input
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={onInput}
        placeholder="Search by name, ID, email, phone…"
        className="w-72 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />
      <svg
        className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>
    </div>
  );
}
