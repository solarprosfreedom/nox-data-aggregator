"use client";

import { useSearchParams } from "next/navigation";
import { useProjectsPager } from "./useProjectsPager";

export type ProjectFilterParamKey = "setter" | "salesRep" | "status" | "installer";

export function useProjectFilterParam(key: ProjectFilterParamKey) {
  const searchParams = useSearchParams();
  const { replaceSearchParams } = useProjectsPager();

  const value = searchParams.get(key) ?? "";

  function setValue(next: string) {
    replaceSearchParams((params) => {
      if (next) params.set(key, next);
      else params.delete(key);
      params.delete("page");
    });
  }

  return { value, setValue };
}

export function useProjectFilterValues() {
  const searchParams = useSearchParams();
  const setter = searchParams.get("setter") ?? "";
  const salesRep = searchParams.get("salesRep") ?? "";
  const status = searchParams.get("status") ?? "";
  const activeCount = [setter, salesRep, status].filter(Boolean).length;
  return { setter, salesRep, status, activeCount };
}
