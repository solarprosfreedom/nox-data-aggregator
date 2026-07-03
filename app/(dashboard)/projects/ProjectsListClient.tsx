"use client";

import Pagination from "@/components/ui/Pagination";
import {
  ProjectsPagerProvider,
  useProjectsPager,
} from "./useProjectsPager";
import {
  ProjectsTableMetaProvider,
  useProjectsTableTotal,
} from "./ProjectsTableMeta";
import { SystemSizeUnitProvider } from "./SystemSizeUnitContext";

/** Matches the loaded table viewport so layout does not jump between loading and loaded. */
const TABLE_PANEL_HEIGHT = "calc(100vh - 180px)";

function TableLoadingOverlay({ message }: { message: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-[1px]"
      aria-busy="true"
      aria-label={message}
    >
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-cyan-600" />
      <span className="text-sm font-medium text-slate-600">{message}</span>
    </div>
  );
}

export default function ProjectsListClient({
  toolbar,
  children,
}: {
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ProjectsPagerProvider>
      <ProjectsTableMetaProvider>
        <SystemSizeUnitProvider>
          <ProjectsListBody toolbar={toolbar}>{children}</ProjectsListBody>
        </SystemSizeUnitProvider>
      </ProjectsTableMetaProvider>
    </ProjectsPagerProvider>
  );
}

function ProjectsListBody({
  toolbar,
  children,
}: {
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isNavigating, loadingMessage } = useProjectsPager();
  const total = useProjectsTableTotal();

  return (
    <>
      {toolbar}

      <div
        className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        style={{ height: TABLE_PANEL_HEIGHT }}
      >
        <div
          className={`min-h-0 flex-1 overflow-auto transition-opacity duration-150 ${
            isNavigating ? "pointer-events-none opacity-40" : ""
          }`}
        >
          {children}
        </div>

        {total !== null && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/80">
            <Pagination total={total} />
          </div>
        )}

        {isNavigating && <TableLoadingOverlay message={loadingMessage} />}
      </div>
    </>
  );
}
