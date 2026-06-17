import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { SampleDetailContent } from "./SampleDetailContent";

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <SampleDetailContent id={id} />
    </Suspense>
  );
}
