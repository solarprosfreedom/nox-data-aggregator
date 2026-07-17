import { listImportHistory } from "@/lib/data-hub/queries";
import { IMPORT_SOURCE_LABELS, type ImportSource } from "@/lib/data-hub/normalize";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    failed: "bg-red-100 text-red-800",
    processing: "bg-blue-100 text-blue-800",
    pending: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}

export async function ImportHistoryTable() {
  const logs = await listImportHistory(100);

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
        No imports yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Rows</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => {
            const sourceKey = log.source as ImportSource;
            const isRemittance = sourceKey === "remittance";
            return (
              <tr key={log.id}>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-xs font-medium">
                  {IMPORT_SOURCE_LABELS[sourceKey] ?? sourceKey}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {log.filename ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs">{log.row_count}</td>
                <td className="px-4 py-3 text-xs">
                  {isRemittance ? (
                    <>
                      {log.inserted_count} saved
                      {log.matched_count > 0 ? `, ${log.matched_count} linked` : ""}
                      {log.error_count > 0 ? `, ${log.error_count} err` : ""}
                    </>
                  ) : (
                    <>
                      {log.inserted_count} new, {log.updated_count} updated
                      {log.error_count > 0 ? `, ${log.error_count} err` : ""}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={log.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
