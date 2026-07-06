import Link from "next/link";
import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import PageHeader from "@/components/ui/PageHeader";
import { IconHistory, IconUpload } from "@/components/ui/icons";
import { ImportHistoryTable } from "./ImportHistoryTable";

export default function ImportHistoryPage() {
  return (
    <div>
      <PageHeader
        icon={<IconHistory size={20} />}
        title="Import history"
        actions={
          <Link
            href="/imports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-600 bg-orange-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-700"
          >
            <IconUpload size={16} />
            New import
          </Link>
        }
      />

      <Suspense fallback={<PageSkeleton />}>
        <ImportHistoryTable />
      </Suspense>
    </div>
  );
}
