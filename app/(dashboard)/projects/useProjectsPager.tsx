"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { projectsTableQueryKey } from "@/lib/data-hub/projects-query-key";

function readUrlState(searchParams: URLSearchParams) {
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [25, 50, 100].includes(Number(searchParams.get("pageSize")))
      ? Number(searchParams.get("pageSize"))
      : 25,
  };
}

type PagerContextValue = {
  displayPage: number;
  displayPageSize: number;
  goToPage: (page: number) => void;
  changePageSize: (size: number) => void;
  replaceSearchParams: (build: (params: URLSearchParams) => void) => void;
  markTableLoaded: (queryKey: string) => void;
  isNavigating: boolean;
  loadingMessage: string;
};

const PagerContext = createContext<PagerContextValue | null>(null);

export function ProjectsPagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingQueryKey, setPendingQueryKey] = useState<string | null>(null);
  const [navKind, setNavKind] = useState<"page" | "update">("update");

  const url = readUrlState(searchParams);
  const displayPage = url.page;
  const displayPageSize = url.pageSize;

  const replaceSearchParams = useCallback(
    (build: (params: URLSearchParams) => void, kind: "page" | "update" = "update") => {
      const params = new URLSearchParams(searchParams.toString());
      build(params);
      setNavKind(kind);
      setPendingQueryKey(projectsTableQueryKey(params));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const goToPage = useCallback(
    (page: number) => {
      replaceSearchParams((params) => {
        params.set("page", String(page));
      }, "page");
    },
    [replaceSearchParams]
  );

  const changePageSize = useCallback(
    (size: number) => {
      replaceSearchParams((params) => {
        params.set("pageSize", String(size));
        params.set("page", "1");
      }, "page");
    },
    [replaceSearchParams]
  );

  const markTableLoaded = useCallback((queryKey: string) => {
    setPendingQueryKey((pending) => (pending === queryKey ? null : pending));
  }, []);

  // Safety: never leave the overlay stuck if something fails silently.
  useEffect(() => {
    if (pendingQueryKey === null) return;
    const timer = window.setTimeout(() => setPendingQueryKey(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [pendingQueryKey]);

  const isNavigating = pendingQueryKey !== null;

  const loadingMessage =
    navKind === "page" ? "Loading page…" : "Updating results…";

  const value = useMemo(
    () => ({
      displayPage,
      displayPageSize,
      goToPage,
      changePageSize,
      replaceSearchParams,
      markTableLoaded,
      isNavigating,
      loadingMessage,
    }),
    [
      displayPage,
      displayPageSize,
      goToPage,
      changePageSize,
      replaceSearchParams,
      markTableLoaded,
      isNavigating,
      loadingMessage,
    ]
  );

  return <PagerContext.Provider value={value}>{children}</PagerContext.Provider>;
}

export function useProjectsPager() {
  const ctx = useContext(PagerContext);
  if (!ctx) throw new Error("useProjectsPager must be used within ProjectsPagerProvider");
  return ctx;
}

export function useProjectsPagerOptional() {
  return useContext(PagerContext);
}

export { projectsTableQueryKey } from "@/lib/data-hub/projects-query-key";
