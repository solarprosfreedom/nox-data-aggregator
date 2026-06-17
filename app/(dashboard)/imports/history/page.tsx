import Link from "next/link";
import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { ImportHistoryTable } from "./ImportHistoryTable";

export default function ImportHistoryPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import history</h1>
          <p className="text-sm text-slate-500">Audit log of all uploads</p>
        </div>
        <Link
          href="/imports"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          New import
        </Link>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <ImportHistoryTable />
      </Suspense>
    </div>
  );
}
