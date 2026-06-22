import Link from "next/link";
import { listProjectsPaged } from "@/lib/data-hub/queries";
import Pagination from "@/components/ui/Pagination";
import EditProjectDrawer from "./EditProjectDrawer";
import DeleteProjectButton from "./DeleteProjectButton";

function Str({ v }: { v: unknown }) {
  if (v == null || v === "") return <span className="text-slate-300">—</span>;
  return <>{String(v)}</>;
}

function Phone({ v }: { v: unknown }) {
  if (v == null || v === "") return <span className="text-slate-300">—</span>;
  const raw = String(v).trim();
  const digits = raw.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return <>{raw}</>;
  return <>({normalized.slice(0, 3)}) {normalized.slice(3, 6)}-{normalized.slice(6)}</>;
}

function Money({ v }: { v: unknown }) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const n = Number(v);
  if (isNaN(n)) return <span className="text-slate-300">—</span>;
  return <>${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function Num({ v }: { v: unknown }) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const n = Number(v);
  if (isNaN(n)) return <>{String(v)}</>;
  return <>{n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function TH({ children }: { children?: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 font-medium">{children}</th>;
}

function TD({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 ${mono ? "font-mono text-xs" : "text-xs"}`}>
      {children}
    </td>
  );
}

function customerName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const idx = name.indexOf(" - ");
  return (idx >= 0 ? name.slice(0, idx) : name).trim() || null;
}

function systemSizeWatts(kw: number | null | undefined) {
  if (kw == null) return <span className="text-slate-300">—</span>;
  const n = Number(kw);
  if (isNaN(n)) return <span className="text-slate-300">—</span>;
  return <>{Math.round(n * 1000).toLocaleString("en-US")} W</>;
}

/** Latest remittance status wins over project stage when present. */
function projectStage(
  projectStageVal: string | null | undefined,
  remitStatus: string | null | undefined
) {
  return remitStatus?.trim() || projectStageVal?.trim() || null;
}

/** Sales rep: closer or sales advisor; if only setter exists, use setter. */
function salesRepName(p: {
  closer_name?: string | null;
  sales_advisor_name?: string | null;
  setter_name?: string | null;
}) {
  return (
    p.closer_name?.trim() ||
    p.sales_advisor_name?.trim() ||
    p.setter_name?.trim() ||
    null
  );
}

export async function ProjectsTable({
  search,
  page = 1,
  pageSize = 25,
  userEmail,
  isAdmin = true,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
  userEmail?: string;
  isAdmin?: boolean;
}) {
  const { rows: projects, total } = await listProjectsPaged({ page, pageSize, search, userEmail });

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        {search
          ? `${total} result${total === 1 ? "" : "s"} for "${search}"`
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
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm" style={{ maxHeight: "calc(100vh - 180px)" }}>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {/* Identity */}
                <TH>#</TH>
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
                <TH>Sales Rep</TH>
                {/* Org */}
                <TH>Installer</TH>
                {/* Remittance (latest) */}
                <TH>Pmt Date</TH>
                <TH>Finance Type</TH>
                <TH>Financier</TH>
                <TH>Utility</TH>
                <TH>PV Size</TH>
                <TH>Redline Tier</TH>
                <TH>Contract Amt</TH>
                <TH>Gross PPW</TH>
                <TH>PPW</TH>
                <TH>Finance Fee</TH>
                <TH>Cash Deal</TH>
                <TH>Battery</TH>
                <TH>Adder Amt</TH>
                <TH>Adder Detail</TH>
                <TH>Post-Sale WO</TH>
                <TH>Post-Sale Adders</TH>
                <TH>PV Only Price</TH>
                <TH>Down Pmt</TH>
                <TH>SPIF</TH>
                <TH>TPO Rebate</TH>
                <TH>ETQA</TH>
                <TH>Enfin DCA</TH>
                <TH>Light Reach DCA</TH>
                <TH>Partner Comm</TH>
                <TH>Partner Incentive</TH>
                <TH>Re-Payment</TH>
                <TH>C0</TH>
                <TH>C1</TH>
                <TH>C2</TH>
                <TH>Adj C2</TH>
                <TH>C0 Paid</TH>
                <TH>C1 Paid</TH>
                <TH>C2 Paid</TH>
                <TH>Incentive Paid</TH>
                <TH>Clawback</TH>
                <TH>Others</TH>
                <TH>Total SP Paid</TH>
                {isAdmin && <TH></TH>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  {/* Identity */}
                  <TD mono>
                    <span className="text-slate-400">{(page - 1) * pageSize + i + 1}</span>
                  </TD>
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
                      <Str v={customerName(p.opportunity_name)} />
                    </span>
                  </TD>
                  <TD><Str v={p.email} /></TD>
                  <TD><Phone v={p.phone} /></TD>
                  {/* Address */}
                  <TD><Str v={p.address_line1} /></TD>
                  <TD><Str v={p.city} /></TD>
                  <TD><Str v={p.state_code} /></TD>
                  <TD><Str v={p.postal_code} /></TD>
                  {/* Deal */}
                  <TD><Str v={projectStage(p.project_stage, p.remittance?.status)} /></TD>
                  <TD><Str v={p.contract_signed_date} /></TD>
                  <TD>{systemSizeWatts(p.system_size_kw)}</TD>
                  <TD><Money v={p.total_system_cost} /></TD>
                  {/* People */}
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Str v={p.setter_name} />
                      {!p.terros_account_id && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400"
                          title="No Terros match — setter/closer may be missing"
                        />
                      )}
                    </div>
                  </TD>
                  <TD><Str v={salesRepName(p)} /></TD>
                  {/* Org */}
                  <TD><Str v={p.installer} /></TD>
                  {/* Remittance (latest) */}
                  <TD><Str v={p.remittance?.payment_date} /></TD>
                  <TD><Str v={p.remittance?.finance_type} /></TD>
                  <TD><Str v={p.remittance?.financier} /></TD>
                  <TD><Str v={p.remittance?.utility_provider} /></TD>
                  <TD><Num v={p.remittance?.pv_size} /></TD>
                  <TD><Money v={p.remittance?.redline_price_tier} /></TD>
                  <TD><Money v={p.remittance?.contract_amount} /></TD>
                  <TD><Money v={p.remittance?.gross_ppw} /></TD>
                  <TD><Money v={p.remittance?.ppw} /></TD>
                  <TD><Money v={p.remittance?.finance_fee} /></TD>
                  <TD><Money v={p.remittance?.cash_deal_value} /></TD>
                  <TD><Money v={p.remittance?.battery_price} /></TD>
                  <TD><Money v={p.remittance?.adder_amount} /></TD>
                  <TD><Str v={p.remittance?.contract_adder_detail} /></TD>
                  <TD><Money v={p.remittance?.post_sale_adder_work_order} /></TD>
                  <TD><Money v={p.remittance?.post_sale_adders} /></TD>
                  <TD><Money v={p.remittance?.pv_only_price} /></TD>
                  <TD><Money v={p.remittance?.down_payment} /></TD>
                  <TD><Money v={p.remittance?.spif} /></TD>
                  <TD><Money v={p.remittance?.tpo_rebate} /></TD>
                  <TD><Money v={p.remittance?.etqa} /></TD>
                  <TD><Money v={p.remittance?.enfin_dca} /></TD>
                  <TD><Money v={p.remittance?.light_reach_dca} /></TD>
                  <TD><Money v={p.remittance?.partner_commission} /></TD>
                  <TD><Money v={p.remittance?.partner_incentive} /></TD>
                  <TD><Money v={p.remittance?.re_payment} /></TD>
                  <TD><Money v={p.remittance?.c0} /></TD>
                  <TD><Money v={p.remittance?.c1} /></TD>
                  <TD><Money v={p.remittance?.c2} /></TD>
                  <TD><Money v={p.remittance?.adjusted_c2} /></TD>
                  <TD><Money v={p.remittance?.c0_paid} /></TD>
                  <TD><Money v={p.remittance?.c1_paid} /></TD>
                  <TD><Money v={p.remittance?.c2_paid} /></TD>
                  <TD><Money v={p.remittance?.incentive_paid} /></TD>
                  <TD><Money v={p.remittance?.clawback} /></TD>
                  <TD><Money v={p.remittance?.others} /></TD>
                  <TD><Money v={p.remittance?.total_sp_paid} /></TD>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center gap-1">
                        <EditProjectDrawer project={p} />
                        <DeleteProjectButton id={p.id} label={p.opportunity_name ?? p.project_id} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {projects.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} />
      )}
    </>
  );
}
