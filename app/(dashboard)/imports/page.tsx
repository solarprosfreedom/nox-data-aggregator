import Link from "next/link";
import ImportUploadForm from "./ImportUploadForm";

export default function ImportsPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Import data</h1>
        <Link
          href="/imports/history"
          className="text-sm font-medium text-cyan-700 hover:underline"
        >
          View history →
        </Link>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Upload a daily project sheet or weekly remittance file. Source is
        auto-detected; each run is logged in{" "}
        <strong>hub_import_log</strong>.
      </p>

      <ImportUploadForm />

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Required columns by source</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong>Projects sheet</strong> —{" "}
            <code className="text-xs">HES ID</code> (unique key; re-import
            updates existing rows)
          </li>
          <li>
            <strong>Remittance</strong> —{" "}
            <code className="text-xs">HES Code</code> +{" "}
            <code className="text-xs">Payment date</code> (links to project if
            HES Code matches)
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Export from Numbers/Excel as CSV (tab- or comma-separated). Use{" "}
          <Link href="/samples" className="text-cyan-700 hover:underline">
            Samples
          </Link>{" "}
          to store reference files.
        </p>
      </div>
    </div>
  );
}
