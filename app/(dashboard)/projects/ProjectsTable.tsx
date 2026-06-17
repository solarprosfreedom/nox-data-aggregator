import Link from "next/link";
import { listProjects, countProjects } from "@/lib/data-hub/queries";

export async function ProjectsTable({ search }: { search?: string }) {
  const [projects, total] = await Promise.all([
    listProjects(200, search),
    countProjects(),
  ]);

  return (
    <>
      <p className="mb-6 text-sm text-slate-500">
        {total} consolidated project{total === 1 ? "" : "s"}
      </p>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">No projects yet.</p>
          <p className="mt-2 text-sm text-slate-400">
            Upload a projects sheet, Terros export, or remittance file to get
            started.
          </p>
          <Link
            href="/imports"
            className="mt-4 inline-block text-sm font-medium text-cyan-700 hover:underline"
          >
            Go to imports →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Project ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Setter</th>
                <th className="px-4 py-3">Advisor</th>
                <th className="px-4 py-3">System Size</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-cyan-700 hover:underline"
                    >
                      {p.project_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {p.opportunity_name ?? "—"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.email ?? p.phone ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.project_stage ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.setter_name ?? p.setter_email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.sales_advisor_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.system_size_kw != null ? `${p.system_size_kw} kW` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
