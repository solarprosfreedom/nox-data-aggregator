"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconSearch } from "@/components/ui/icons";
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
    <div className="relative w-full max-w-md">
      <IconSearch
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={onInput}
        placeholder="Search name, ID, email, phone…"
        className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder-slate-400 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
      />
    </div>
  );
}
