import { Suspense } from "react";
import PageSkeleton from "@/components/ui/PageSkeleton";
import SampleUploadForm from "./SampleUploadForm";
import { SamplesTable } from "./SamplesTable";

export default function SamplesPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Sample CSVs</h1>
      <p className="mb-6 text-sm text-slate-500">
        Reference files for Axia, Terros, remittance, and other sources. Use
        these to inspect column names before building import mappings.
      </p>

      <SampleUploadForm />

      <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">
        Saved samples
      </h2>

      <Suspense fallback={<PageSkeleton />}>
        <SamplesTable />
      </Suspense>
    </div>
  );
}
