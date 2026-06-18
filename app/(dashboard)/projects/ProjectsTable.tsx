import Link from "next/link";
import { listProjects, countProjects } from "@/lib/data-hub/queries";

function Str({ v }: { v: unknown }) {
  if (v == null || v === "") return <span className="text-slate-300">—</span>;
  return <>{String(v)}</>;
}

function Money({ v }: { v: unknown }) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const n = Number(v);
  if (isNaN(n)) return <span className="text-slate-300">—</span>;
  return <>${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function TH({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 font-medium">{children}</th>;
}

function TD({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 ${mono ? "font-mono text-xs" : "text-xs"}`}>
      {children}
    </td>
  );
}

export async function ProjectsTable({ search }: { search?: string }) {
  const [projects, total] = await Promise.all([
    listProjects(500, search),
    countProjects(),
  ]);

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        {search
          ? `${projects.length} result${projects.length === 1 ? "" : "s"} for "${search}" (of ${total} total)`
          : `${total} consolidated project${total === 1 ? "" : "s"}`}
      </p>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">No projects yet.</p>
          <p className="mt-2 text-sm text-slate-400">
            Upload a projects sheet to get started.
          </p>
          <Link
            href="/imports"
            className="mt-4 inline-block text-sm font-medium text-cyan-700 hover:underline"
          >
            Go to imports →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {/* Identity */}
                <TH>Project ID</TH>
                <TH>Customer</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                {/* Address */}
                <TH>Address</TH>
                <TH>City</TH>
                <TH>State</TH>
                <TH>Zip</TH>
                {/* Deal */}
                <TH>Stage</TH>
                <TH>Contract Date</TH>
                <TH>System Size</TH>
                <TH>Total Cost</TH>
                {/* People */}
                <TH>Setter</TH>
                <TH>Advisor</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  {/* Identity */}
                  <TD mono>
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-cyan-700 hover:underline"
                    >
                      {p.project_id}
                    </Link>
                  </TD>
                  <TD>
                    <span className="font-medium text-slate-900">
                      <Str v={p.opportunity_name} />
                    </span>
                  </TD>
                  <TD><Str v={p.email} /></TD>
                  <TD><Str v={p.phone} /></TD>
                  {/* Address */}
                  <TD><Str v={p.address_line1} /></TD>
                  <TD><Str v={p.city} /></TD>
                  <TD><Str v={p.state_code} /></TD>
                  <TD><Str v={p.postal_code} /></TD>
                  {/* Deal */}
                  <TD><Str v={p.project_stage} /></TD>
                  <TD><Str v={p.contract_signed_date} /></TD>
                  <TD>
                    {p.system_size_kw != null ? `${p.system_size_kw} kW` : <span className="text-slate-300">—</span>}
                  </TD>
                  <TD><Money v={p.total_system_cost} /></TD>
                  {/* People */}
                  <TD><Str v={p.setter_name} /></TD>
                  <TD><Str v={p.sales_advisor_name} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
