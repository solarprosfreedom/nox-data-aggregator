/** Columns on `projects` that may be used for server-side sort. */
export const PROJECT_SORT_COLUMNS = {
  project_id: "project_id",
  opportunity_name: "opportunity_name",
  email: "email",
  phone: "phone",
  address_line1: "address_line1",
  city: "city",
  state_code: "state_code",
  postal_code: "postal_code",
  project_stage: "project_stage",
  contract_signed_date: "contract_signed_date",
  system_size_kw: "system_size_kw",
  total_system_cost: "total_system_cost",
  setter_name: "setter_name",
  closer_name: "closer_name",
  sales_advisor_name: "sales_advisor_name",
  installer: "installer",
  updated_at: "updated_at",
} as const;

export type ProjectSortColumn = keyof typeof PROJECT_SORT_COLUMNS;

export function parseProjectSort(
  sort?: string,
  sortDir?: string
): { column: ProjectSortColumn; ascending: boolean } {
  const column =
    sort && sort in PROJECT_SORT_COLUMNS
      ? (sort as ProjectSortColumn)
      : "updated_at";
  const ascending = sortDir === "asc";
  return { column, ascending };
}
