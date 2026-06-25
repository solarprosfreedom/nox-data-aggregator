import Link from "next/link";
import { Suspense } from "react";
import ProjectsListClient from "./ProjectsListClient";
import ProjectsTableSkeleton from "./ProjectsTableSkeleton";
import { ProjectsTableSection } from "./ProjectsTableSection";
import ExportCsvButton from "@/components/ui/ExportCsvButton";
import SyncSettersButton from "./SyncSettersButton";
import SequifiSyncInlineButton from "./SequifiSyncInlineButton";
import { getCurrentProfile } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const { q } = params;
  const exportParams = new URLSearchParams();
  if (typeof q === "string" && q) exportParams.set("q", q);
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v && (key.startsWith("cf_") || ["installer", "setter", "salesRep", "status"].includes(key))) {
      exportParams.set(key, v);
    }
  }
  const exportHref = `/api/export/projects${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <div className="flex items-center gap-3">
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

      <ProjectsListClient>
        <Suspense fallback={<ProjectsTableSkeleton />}>
          <ProjectsTableSection params={params} />
        </Suspense>
      </ProjectsListClient>
    </div>
  );
}
