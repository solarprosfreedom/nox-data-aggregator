import Link from "next/link";
import { Suspense } from "react";
import ProjectsListClient from "./ProjectsListClient";
import ProjectsTableSkeleton from "./ProjectsTableSkeleton";
import { ProjectsTableSection } from "./ProjectsTableSection";
import { ProjectsToolbar, ToolbarSkeleton } from "./ProjectsToolbar";
import ExportCsvButton from "@/components/ui/ExportCsvButton";
import SyncSettersButton from "./SyncSettersButton";
import SequifiSyncInlineButton from "./SequifiSyncInlineButton";
import PageHeader from "@/components/ui/PageHeader";
import { IconProjects, IconUpload } from "@/components/ui/icons";
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
      <PageHeader
        icon={<IconProjects size={20} />}
        title="Projects"
        actions={
          isAdmin ? (
            <>
              <SyncSettersButton />
              <SequifiSyncInlineButton />
              <ExportCsvButton href={exportHref} />
              <Link
                href="/imports"
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-600 bg-orange-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-700"
              >
                <IconUpload size={16} />
                Import data
              </Link>
            </>
          ) : undefined
        }
      />

      <ProjectsListClient
        toolbar={
          <Suspense fallback={<ToolbarSkeleton />}>
            <ProjectsToolbar />
          </Suspense>
        }
      >
        <Suspense fallback={<ProjectsTableSkeleton />}>
          <ProjectsTableSection params={params} />
        </Suspense>
      </ProjectsListClient>
    </div>
  );
}
