import Link from "next/link";
import { ProjectsTable } from "./ProjectsTable";
import ProjectsSearch from "./ProjectsSearch";
import InstallerFilter from "./InstallerFilter";
import PeopleStatusFilters from "./PeopleStatusFilters";
import ExportCsvButton from "@/components/ui/ExportCsvButton";
import SyncSettersButton from "./SyncSettersButton";
import SequifiSyncInlineButton from "./SequifiSyncInlineButton";
import { getCurrentProfile } from "@/lib/auth/profile";
import { parseProjectSort } from "@/lib/data-hub/project-sort";
import { listInstallerNames } from "@/lib/data-hub/mapping-templates";
import { listProjectFilterValues } from "@/lib/data-hub/queries";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    installer?: string;
    setter?: string;
    salesRep?: string;
    status?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    sortDir?: string;
  }>;
}) {
  const {
    q,
    installer,
    setter,
    salesRep,
    status,
    page: pageParam,
    pageSize: pageSizeParam,
    sort,
    sortDir,
  } =
    await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const pageSize = [25, 50, 100].includes(Number(pageSizeParam)) ? Number(pageSizeParam) : 25;
  const { column, ascending } = parseProjectSort(sort, sortDir);
  const installers = await listInstallerNames();
  const filterValues = await listProjectFilterValues();

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  // Non-admins only see projects where they are the setter, closer, or sales advisor.
  const userEmail = isAdmin ? undefined : (profile?.email ?? undefined);
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (installer?.trim()) exportParams.set("installer", installer.trim());
  if (setter?.trim()) exportParams.set("setter", setter.trim());
  if (salesRep?.trim()) exportParams.set("salesRep", salesRep.trim());
  if (status?.trim()) exportParams.set("status", status.trim());
  const exportHref = `/api/export/projects${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <div className="flex items-center gap-3">
          <InstallerFilter installers={installers} />
          <ProjectsSearch />
          {isAdmin && (
            <>
              <SyncSettersButton />
              <SequifiSyncInlineButton />
              <ExportCsvButton href={exportHref} />
              <Link
                href="/imports"
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
              >
                Import data
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-8 mt-1 border-t border-slate-200 pt-6">
        <PeopleStatusFilters
          setters={filterValues.setters}
          salesReps={filterValues.salesReps}
          statuses={filterValues.statuses}
        />
      </div>

      <ProjectsTable
        search={q}
        installer={installer}
        setter={setter}
        salesRep={salesRep}
        status={status}
        page={page}
        pageSize={pageSize}
        sort={column}
        sortDir={ascending ? "asc" : "desc"}
        userEmail={userEmail}
        isAdmin={isAdmin}
      />
    </div>
  );
}
