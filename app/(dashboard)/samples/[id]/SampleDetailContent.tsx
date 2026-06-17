import Link from "next/link";
import { notFound } from "next/navigation";
import { getSampleCsvFile } from "@/lib/data-hub/sample-queries";
import {
  previewSampleRows,
  SOURCE_TYPE_LABELS,
} from "@/lib/data-hub/samples";
import DeleteSampleButton from "./DeleteSampleButton";

export async function SampleDetailContent({ id }: { id: string }) {
  const sample = await getSampleCsvFile(id);
  if (!sample) notFound();

  const preview = previewSampleRows(sample.file_content, 20);

  return (
    <div>
      <Link
        href="/samples"
        className="text-sm text-cyan-700 hover:underline"
      >
        ← All samples
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{sample.label}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {SOURCE_TYPE_LABELS[sample.source_type]}
            {sample.installer ? ` · ${sample.installer}` : ""}
            {" · "}
            {sample.file_name}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/samples/${id}/download`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download CSV
          </a>
          <DeleteSampleButton id={id} />
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase text-slate-400">Data rows</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">
            {sample.row_count}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase text-slate-400">Columns</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">
            {sample.column_headers?.length ?? 0}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase text-slate-400">Added</dt>
          <dd className="mt-1 text-sm font-medium text-slate-900">
            {new Date(sample.created_at).toLocaleString()}
          </dd>
        </div>
      </dl>

      {sample.notes && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-800">Notes</p>
          <p className="mt-1 whitespace-pre-wrap">{sample.notes}</p>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Columns</h2>
        <div className="flex flex-wrap gap-2">
          {(sample.column_headers ?? []).map((col) => (
            <span
              key={col}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {col}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Preview (first {preview.rows.length} rows)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                {preview.headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.rows.map((row, i) => (
                <tr key={i}>
                  {preview.headers.map((_, j) => (
                    <td
                      key={j}
                      className="max-w-[14rem] truncate whitespace-nowrap px-3 py-2 text-slate-700"
                      title={row[j] ?? ""}
                    >
                      {row[j] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
