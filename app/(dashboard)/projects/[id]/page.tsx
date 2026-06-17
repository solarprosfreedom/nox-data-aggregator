import Link from "next/link";
import { Suspense } from "react";
import {
  ProjectDetailContent,
  ProjectDetailSkeleton,
} from "./ProjectDetailContent";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-4xl">
      <Link href="/projects" className="text-sm text-cyan-700 hover:underline">
        ← Projects
      </Link>

      <Suspense fallback={<ProjectDetailSkeleton />}>
        <ProjectDetailContent id={id} />
      </Suspense>
    </div>
  );
}
