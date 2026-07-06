import Link from "next/link";
import { listSampleCsvFiles } from "@/lib/data-hub/sample-queries";
import { SOURCE_TYPE_LABELS } from "@/lib/data-hub/samples";

export async function SamplesTable() {
  const samples = await listSampleCsvFiles(100);

  if (samples.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-slate-600">No sample files yet.</p>
        <p className="mt-2 text-sm text-slate-400">
          Upload a reference CSV above to capture column headers for mapping.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Label</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Installer</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Rows</th>
            <th className="px-4 py-3">Columns</th>
            <th className="px-4 py-3">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {samples.map((sample) => (
            <tr key={sample.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link
                  href={`/samples/${sample.id}`}
                  className="font-medium text-orange-700 hover:underline"
                >
                  {sample.label}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs">
                {SOURCE_TYPE_LABELS[sample.source_type]}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {sample.installer ?? "—"}
              </td>
              <td className="max-w-[12rem] truncate px-4 py-3 text-xs text-slate-500">
                {sample.file_name}
              </td>
              <td className="px-4 py-3">{sample.row_count}</td>
              <td className="px-4 py-3">
                {sample.column_headers?.length ?? "—"}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(sample.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
