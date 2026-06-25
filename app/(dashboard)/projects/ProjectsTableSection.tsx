import { getCurrentProfile } from "@/lib/auth/profile";
import { parseProjectSort } from "@/lib/data-hub/project-sort";
import {
  legacyParamsToColumnFilters,
  mergeColumnFilters,
  parseColumnFilters,
} from "@/lib/data-hub/column-filters";
import { listProjectFilterValues } from "@/lib/data-hub/queries";
import {
  projectsTableQueryKey,
  searchParamsFromPageParams,
} from "@/lib/data-hub/projects-query-key";
import { ProjectsTable } from "./ProjectsTable";

/** Suspended segment: loads filter options + table rows. */
export async function ProjectsTableSection({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
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
  } = params;

  const page = Math.max(1, Number(pageParam) || 1);
  const pageSize = [25, 50, 100].includes(Number(pageSizeParam)) ? Number(pageSizeParam) : 25;
  const { column, ascending } = parseProjectSort(
    typeof sort === "string" ? sort : undefined,
    typeof sortDir === "string" ? sortDir : undefined
  );
  const columnFilters = mergeColumnFilters(
    parseColumnFilters(params),
    legacyParamsToColumnFilters({
      setter: typeof setter === "string" ? setter : undefined,
      salesRep: typeof salesRep === "string" ? salesRep : undefined,
      status: typeof status === "string" ? status : undefined,
      installer: typeof installer === "string" ? installer : undefined,
    })
  );

  const [filterValues, profile] = await Promise.all([
    listProjectFilterValues(),
    getCurrentProfile(),
  ]);

  const isAdmin = profile?.role === "admin";
  const userEmail = isAdmin ? undefined : (profile?.email ?? undefined);
  const queryKey = projectsTableQueryKey(searchParamsFromPageParams(params));

  return (
    <ProjectsTable
      queryKey={queryKey}
      search={typeof q === "string" ? q : undefined}
      installer={typeof installer === "string" ? installer : undefined}
      setter={typeof setter === "string" ? setter : undefined}
      salesRep={typeof salesRep === "string" ? salesRep : undefined}
      status={typeof status === "string" ? status : undefined}
      columnFilters={columnFilters}
      page={page}
      pageSize={pageSize}
      sort={column}
      sortDir={ascending ? "asc" : "desc"}
      userEmail={userEmail}
      isAdmin={isAdmin}
      filterOptions={{
        setters: filterValues.setters,
        salesReps: filterValues.salesReps,
      }}
    />
  );
}
