import Link from "next/link";
import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { ProjectsTable } from "./ProjectsTable";
import ProjectsSearch from "./ProjectsSearch";
import ExportCsvButton from "@/components/ui/ExportCsvButton";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <div className="flex items-center gap-3">
          <ProjectsSearch />
          <ExportCsvButton
            href={`/api/export/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          />
          <Link
            href="/imports"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Import data
          </Link>
        </div>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <ProjectsTable search={q} />
      </Suspense>
    </div>
  );
}
