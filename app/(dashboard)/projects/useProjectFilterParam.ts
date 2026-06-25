"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ProjectFilterParamKey = "setter" | "salesRep" | "status" | "installer";

export function useProjectFilterParam(key: ProjectFilterParamKey) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(key) ?? "";

  function setValue(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(key, next);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
