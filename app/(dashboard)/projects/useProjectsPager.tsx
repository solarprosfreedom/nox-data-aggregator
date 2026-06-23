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

function readUrlState(searchParams: URLSearchParams) {
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [25, 50, 100].includes(Number(searchParams.get("pageSize")))
      ? Number(searchParams.get("pageSize"))
      : 25,
    sort: searchParams.get("sort") ?? "updated_at",
    sortDir: searchParams.get("sortDir") ?? "desc",
    q: searchParams.get("q") ?? "",
    installer: searchParams.get("installer") ?? "",
  };
}

export function projectsTableQueryKey(opts: {
  page: number;
  pageSize: number;
  sort: string;
  sortDir: string;
  q?: string;
  installer?: string;
}) {
  return [opts.page, opts.pageSize, opts.sort, opts.sortDir, opts.q ?? "", opts.installer ?? ""].join(
    "|"
  );
}

export function readProjectsUrlState(searchParams: URLSearchParams) {
  return readUrlState(searchParams);
}

type PagerContextValue = {
  displayPage: number;
  displayPageSize: number;
  goToPage: (page: number) => void;
  changePageSize: (size: number) => void;
  isNavigating: boolean;
};

const PagerContext = createContext<PagerContextValue | null>(null);

export function ProjectsPagerProvider({
  serverPage,
  serverPageSize,
  serverSort,
  serverSortDir,
  serverSearch,
  serverInstaller,
  children,
}: {
  serverPage: number;
  serverPageSize: number;
  serverSort: string;
  serverSortDir: string;
  serverSearch?: string;
  serverInstaller?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [pendingPageSize, setPendingPageSize] = useState<number | null>(null);

  const url = readUrlState(searchParams);
  const displayPage = pendingPage ?? url.page;
  const displayPageSize = pendingPageSize ?? url.pageSize;

  const hrefFor = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) params.set(k, v);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams]
  );

  const goToPage = useCallback(
    (page: number) => {
      setPendingPage(page);
      router.replace(hrefFor({ page: String(page) }), { scroll: false });
    },
    [hrefFor, router]
  );

  const changePageSize = useCallback(
    (size: number) => {
      setPendingPageSize(size);
      setPendingPage(1);
      router.replace(hrefFor({ pageSize: String(size), page: "1" }), { scroll: false });
    },
    [hrefFor, router]
  );

  const serverSynced =
    projectsTableQueryKey({
      page: serverPage,
      pageSize: serverPageSize,
      sort: serverSort,
      sortDir: serverSortDir,
      q: serverSearch,
      installer: serverInstaller,
    }) ===
    projectsTableQueryKey({
      page: displayPage,
      pageSize: displayPageSize,
      sort: url.sort,
      sortDir: url.sortDir,
      q: url.q,
      installer: url.installer,
    });

  const isNavigating = pendingPage !== null || pendingPageSize !== null || !serverSynced;

  useEffect(() => {
    if (serverSynced) {
      setPendingPage(null);
      setPendingPageSize(null);
    }
  }, [serverSynced]);

  const value = useMemo(
    () => ({ displayPage, displayPageSize, goToPage, changePageSize, isNavigating }),
    [displayPage, displayPageSize, goToPage, changePageSize, isNavigating]
  );

  return <PagerContext.Provider value={value}>{children}</PagerContext.Provider>;
}

export function useProjectsPager() {
  const ctx = useContext(PagerContext);
  if (!ctx) throw new Error("useProjectsPager must be used within ProjectsPagerProvider");
  return ctx;
}
