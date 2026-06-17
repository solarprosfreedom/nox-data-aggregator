import Link from "next/link";
import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { RemittanceTable } from "./RemittanceTable";
import RemittanceSearch from "./RemittanceSearch";

export default async function RemittancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Remittance</h1>
          <p className="text-sm text-slate-500">
            Weekly payment snapshots by project
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RemittanceSearch />
          <Link
            href="/imports"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Import remittance
          </Link>
        </div>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <RemittanceTable search={q} />
      </Suspense>
    </div>
  );
}
