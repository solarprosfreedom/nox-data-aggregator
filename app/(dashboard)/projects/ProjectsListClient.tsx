"use client";

import Pagination from "@/components/ui/Pagination";
import {
  ProjectsPagerProvider,
  useProjectsPager,
} from "./useProjectsPager";

/** Matches the loaded table viewport so layout does not jump between loading and loaded. */
const TABLE_PANEL_HEIGHT = "calc(100vh - 180px)";

function summaryText(total: number, search?: string) {
  if (search) {
    return `${total} result${total === 1 ? "" : "s"} for "${search}"`;
  }
  return `${total} consolidated project${total === 1 ? "" : "s"}`;
}

export default function ProjectsListClient({
  serverPage,
  serverPageSize,
  serverSort,
  serverSortDir,
  serverSearch,
  serverInstaller,
  total,
  tableMode,
  children,
}: {
  serverPage: number;
  serverPageSize: number;
  serverSort: string;
  serverSortDir: string;
  serverSearch?: string;
  serverInstaller?: string;
  total: number;
  tableMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <ProjectsPagerProvider
      serverPage={serverPage}
      serverPageSize={serverPageSize}
      serverSort={serverSort}
      serverSortDir={serverSortDir}
      serverSearch={serverSearch}
      serverInstaller={serverInstaller}
    >
      <ProjectsListBody total={total} serverSearch={serverSearch} tableMode={tableMode}>
        {children}
      </ProjectsListBody>
    </ProjectsPagerProvider>
  );
}

function ProjectsListBody({
  total,
  serverSearch,
  tableMode,
  children,
}: {
  total: number;
  serverSearch?: string;
  tableMode: boolean;
  children: React.ReactNode;
}) {
  const { isNavigating } = useProjectsPager();

  return (
    <>
      {tableMode && (
        <p className="mb-4 text-sm text-slate-500">{summaryText(total, serverSearch)}</p>
      )}

      {tableMode ? (
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ height: TABLE_PANEL_HEIGHT }}
        >
          {isNavigating ? (
            <div
              className="flex h-full items-center justify-center bg-white"
              aria-busy="true"
              aria-label="Loading projects"
            >
              <div className="flex flex-col items-center gap-4">
                <span className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />
                <span className="text-sm font-medium text-slate-500">Loading page…</span>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">{children}</div>
          )}
        </div>
      ) : (
        children
      )}

      {total > 0 && <Pagination total={total} />}
    </>
  );
}
