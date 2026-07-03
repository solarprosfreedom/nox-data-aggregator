import { listInstallerNames } from "@/lib/data-hub/mapping-templates";
import { listProjectFilterValues } from "@/lib/data-hub/queries";
import ProjectsSearch from "./ProjectsSearch";
import InstallerFilter from "./InstallerFilter";
import PeopleStatusFilters from "./PeopleStatusFilters";

export function ToolbarSkeleton() {
  return (
    <div className="mb-4 flex animate-pulse flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="h-10 w-full max-w-md rounded-xl bg-slate-200" />
      <div className="flex gap-2">
        <div className="h-10 w-36 rounded-xl bg-slate-200" />
        <div className="h-10 w-28 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

export async function ProjectsToolbar() {
  const [installers, filterValues] = await Promise.all([
    listInstallerNames(),
    listProjectFilterValues(),
  ]);

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <ProjectsSearch />
      <div className="flex flex-wrap items-center gap-2">
        <InstallerFilter installers={installers} />
        <PeopleStatusFilters
          setters={filterValues.setters}
          salesReps={filterValues.salesReps}
          statuses={filterValues.statuses}
        />
      </div>
    </div>
  );
}
