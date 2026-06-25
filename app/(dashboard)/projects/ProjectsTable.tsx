import Link from "next/link";
import { listProjectsPaged } from "@/lib/data-hub/queries";
import SortableColumnHeader from "@/components/ui/SortableColumnHeader";
import ColumnHeader from "@/components/ui/ColumnHeader";
import type { ParsedColumnFilters } from "@/lib/data-hub/column-filters";
import type { ProjectSortColumn } from "@/lib/data-hub/project-sort";
import { computeGrossPpw, computeNetPpw } from "@/lib/data-hub/ppw";
import { customerDisplayName, resolveStateCode } from "@/lib/data-hub/normalize";
import EditProjectDrawer from "./EditProjectDrawer";
import DeleteProjectButton from "./DeleteProjectButton";
import TableLoadNotifier from "./TableLoadNotifier";
import { TableTotalNotifier } from "./ProjectsTableMeta";

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

function Ppw({ v }: { v: number | null | undefined }) {
  if (v == null || isNaN(Number(v))) return <span className="text-slate-300">—</span>;
  return <>${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function TH({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b border-slate-200 bg-white px-3 py-3 text-left text-xs font-normal text-slate-600">
      {children}
    </th>
  );
}

function TD({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 ${mono ? "font-mono text-xs" : "text-xs"}`}>
      {children}
    </td>
  );
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
  queryKey,
  search,
  installer,
  setter,
  salesRep,
  status,
  page = 1,
  pageSize = 25,
  sort = "updated_at",
  sortDir = "desc",
  userEmail,
  isAdmin = true,
  columnFilters = { advanced: {}, multiSelect: {} },
  filterOptions,
}: {
  queryKey: string;
  search?: string;
  installer?: string;
  setter?: string;
  salesRep?: string;
  status?: string;
  columnFilters?: ParsedColumnFilters;
  filterOptions: {
    setters: string[];
    salesReps: string[];
  };
  page?: number;
  pageSize?: number;
  sort?: ProjectSortColumn;
  sortDir?: "asc" | "desc";
  userEmail?: string;
  isAdmin?: boolean;
}) {
  const { rows: projects, total } = await listProjectsPaged({
    page,
    pageSize,
    search,
    installer,
    setter,
    salesRep,
    status,
    columnFilters,
    sort,
    sortDir,
    userEmail,
  });

  if (projects.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">No projects match your filters.</p>
          <p className="mt-2 text-sm text-slate-400">
            Try adjusting search or column filters.
          </p>
          <Link
            href="/imports"
            className="mt-4 inline-block text-sm font-medium text-cyan-700 hover:underline"
          >
            Go to imports →
          </Link>
        </div>
        <TableTotalNotifier total={total} />
        <TableLoadNotifier queryKey={queryKey} />
      </>
    );
  }

  return (
    <>
      <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left text-xs text-slate-600">
              <tr>
                {/* Identity */}
                <TH>#</TH>
                <SortableColumnHeader label="Project ID" column="project_id" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="Customer" column="opportunity_name" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="Email" column="email" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="Phone" column="phone" currentSort={sort} currentDir={sortDir} />
                {/* Address */}
                <SortableColumnHeader label="Address" column="address_line1" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="City" column="city" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="State" column="state_code" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="Zip" column="postal_code" currentSort={sort} currentDir={sortDir} />
                {/* Deal */}
                <SortableColumnHeader label="Stage" column="project_stage" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="Contract Date" column="contract_signed_date" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="System Size" column="system_size_kw" currentSort={sort} currentDir={sortDir} />
                <SortableColumnHeader label="Total Cost" column="total_system_cost" currentSort={sort} currentDir={sortDir} />
                <TH>Calc Gross PPW</TH>
                <TH>Calc Net PPW</TH>
                {/* People */}
                <SortableColumnHeader
                  label="Setter"
                  column="setter_name"
                  currentSort={sort}
                  currentDir={sortDir}
                  checkboxOptions={filterOptions.setters}
                />
                <ColumnHeader
                  label="Sales Rep"
                  filterColumnId="sales_rep"
                  checkboxOptions={filterOptions.salesReps}
                />
                {/* Org */}
                <SortableColumnHeader label="Installer" column="installer" currentSort={sort} currentDir={sortDir} />
                {/* Remittance (latest) */}
                <ColumnHeader label="Pmt Date" filterColumnId="payment_date" />
                <ColumnHeader label="Finance Type" filterColumnId="finance_type" />
                <ColumnHeader label="Financier" filterColumnId="financier" />
                <ColumnHeader label="Utility" filterColumnId="utility_provider" />
                <ColumnHeader label="PV Size" filterColumnId="pv_size" />
                <ColumnHeader label="Redline Tier" filterColumnId="redline_price_tier" />
                <ColumnHeader label="Contract Amt" filterColumnId="contract_amount" />
                <ColumnHeader label="Gross PPW" filterColumnId="gross_ppw" />
                <ColumnHeader label="PPW" filterColumnId="ppw" />
                <ColumnHeader label="Finance Fee" filterColumnId="finance_fee" />
                <ColumnHeader label="Cash Deal" filterColumnId="cash_deal_value" />
                <ColumnHeader label="Battery" filterColumnId="battery_price" />
                <ColumnHeader label="Adder Amt" filterColumnId="adder_amount" />
                <ColumnHeader label="Adder Detail" filterColumnId="contract_adder_detail" />
                <ColumnHeader label="Post-Sale WO" filterColumnId="post_sale_adder_work_order" />
                <ColumnHeader label="Post-Sale Adders" filterColumnId="post_sale_adders" />
                <ColumnHeader label="PV Only Price" filterColumnId="pv_only_price" />
                <ColumnHeader label="Down Pmt" filterColumnId="down_payment" />
                <ColumnHeader label="SPIF" filterColumnId="spif" />
                <ColumnHeader label="TPO Rebate" filterColumnId="tpo_rebate" />
                <ColumnHeader label="ETQA" filterColumnId="etqa" />
                <ColumnHeader label="Enfin DCA" filterColumnId="enfin_dca" />
                <ColumnHeader label="Light Reach DCA" filterColumnId="light_reach_dca" />
                <ColumnHeader label="Partner Comm" filterColumnId="partner_commission" />
                <ColumnHeader label="Partner Incentive" filterColumnId="partner_incentive" />
                <ColumnHeader label="Re-Payment" filterColumnId="re_payment" />
                <ColumnHeader label="C0" filterColumnId="c0" />
                <ColumnHeader label="C1" filterColumnId="c1" />
                <ColumnHeader label="C2" filterColumnId="c2" />
                <ColumnHeader label="Adj C2" filterColumnId="adjusted_c2" />
                <ColumnHeader label="C0 Paid" filterColumnId="c0_paid" />
                <ColumnHeader label="C1 Paid" filterColumnId="c1_paid" />
                <ColumnHeader label="C2 Paid" filterColumnId="c2_paid" />
                <ColumnHeader label="Incentive Paid" filterColumnId="incentive_paid" />
                <ColumnHeader label="Clawback" filterColumnId="clawback" />
                <ColumnHeader label="Others" filterColumnId="others" />
                <ColumnHeader label="Total SP Paid" filterColumnId="total_sp_paid" />
                <ColumnHeader label="Payment Status" filterColumnId="payment_status" />
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
                      <Str v={customerDisplayName(p.opportunity_name)} />
                    </span>
                  </TD>
                  <TD><Str v={p.email} /></TD>
                  <TD><Phone v={p.phone} /></TD>
                  {/* Address */}
                  <TD><Str v={p.address_line1} /></TD>
                  <TD><Str v={p.city} /></TD>
                  <TD><Str v={resolveStateCode(p)} /></TD>
                  <TD><Str v={p.postal_code} /></TD>
                  {/* Deal */}
                  <TD><Str v={projectStage(p.project_stage, p.remittance?.status)} /></TD>
                  <TD><Str v={p.contract_signed_date} /></TD>
                  <TD>{systemSizeWatts(p.system_size_kw)}</TD>
                  <TD><Money v={p.total_system_cost} /></TD>
                  <TD>
                    <Ppw
                      v={computeGrossPpw(p.total_system_cost, p.system_size_kw)}
                    />
                  </TD>
                  <TD>
                    <Ppw
                      v={computeNetPpw(
                        p.total_system_cost,
                        p.system_size_kw,
                        p.remittance?.battery_price,
                        p.remittance?.adder_amount
                      )}
                    />
                  </TD>
                  {/* People */}
                  <TD><Str v={p.setter_name} /></TD>
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
                  <TD><Str v={p.remittance?.payment_status} /></TD>
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
      <TableTotalNotifier total={total} />
      <TableLoadNotifier queryKey={queryKey} />
    </>
  );
}
