"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useProjectsPager } from "@/app/(dashboard)/projects/useProjectsPager";

export default function ProjectsSearch() {
  const searchParams = useSearchParams();
  const { replaceSearchParams } = useProjectsPager();
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
      replaceSearchParams((params) => {
        if (val) params.set("q", val);
        else params.delete("q");
        params.delete("page");
      });
    }, 350);
  }

  return (
    <div className="relative">
      <input
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={onInput}
        placeholder="Search by name, ID, email, phone…"
        className="h-10 w-80 rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
