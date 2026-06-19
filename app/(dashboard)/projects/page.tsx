import Link from "next/link";
import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { ProjectsTable } from "./ProjectsTable";
import ProjectsSearch from "./ProjectsSearch";
import ExportCsvButton from "@/components/ui/ExportCsvButton";
import SyncSettersButton from "./SyncSettersButton";
import SequifiSyncInlineButton from "./SequifiSyncInlineButton";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const { q, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const pageSize = [25, 50, 100].includes(Number(pageSizeParam)) ? Number(pageSizeParam) : 25;

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  // Non-admins only see projects where they are the setter, closer, or sales advisor.
  const userEmail = isAdmin ? undefined : (profile?.email ?? undefined);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <div className="flex items-center gap-3">
          <ProjectsSearch />
          {isAdmin && (
            <>
              <SyncSettersButton />
              <SequifiSyncInlineButton />
              <ExportCsvButton
                href={`/api/export/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              />
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

      <Suspense key={`${q ?? ""}-${page}-${pageSize}`} fallback={<PageSkeleton />}>
        <ProjectsTable search={q} page={page} pageSize={pageSize} userEmail={userEmail} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
