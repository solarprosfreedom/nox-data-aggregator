import Link from "next/link";
import { listRemittance } from "@/lib/data-hub/queries";

function Num({ v }: { v: unknown }) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const n = Number(v);
  return <>{isNaN(n) ? String(v) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function Money({ v }: { v: unknown }) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const n = Number(v);
  if (isNaN(n)) return <span className="text-slate-300">—</span>;
  return <>${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function Str({ v }: { v: unknown }) {
  if (v == null || v === "") return <span className="text-slate-300">—</span>;
  return <>{String(v)}</>;
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

export async function RemittanceTable({ search }: { search?: string }) {
  const rows = await listRemittance(500, search);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
        No remittance rows imported yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {/* Identity */}
            <TH>Payment Date</TH>
            <TH>HES Code</TH>
            <TH>Customer</TH>
            <TH>Sales Partner</TH>
            <TH>Sales Advisor</TH>
            <TH>Channel</TH>
            <TH>Status</TH>
            <TH>Linked</TH>
            {/* Contract */}
            <TH>Latest Contract</TH>
            <TH>Contract Date</TH>
            <TH>Finance Type</TH>
            <TH>Financier</TH>
            <TH>Utility Provider</TH>
            {/* Pricing */}
            <TH>PV Size</TH>
            <TH>Redline Price Tier</TH>
            <TH>Contract Amount</TH>
            <TH>Gross PPW</TH>
            <TH>Finance Fee</TH>
            <TH>Cash Deal Value</TH>
            <TH>Battery Price</TH>
            <TH>Adder Amount</TH>
            <TH>Contract Adder Detail</TH>
            <TH>Post Sale WO</TH>
            <TH>Post Sale Adders</TH>
            <TH>PV Only Price</TH>
            <TH>PPW</TH>
            {/* Incentives */}
            <TH>Down Payment</TH>
            <TH>SPIF</TH>
            <TH>TPO Rebate</TH>
            <TH>ETQA</TH>
            <TH>Enfin DCA</TH>
            <TH>Light Reach DCA</TH>
            {/* Commission */}
            <TH>Partner Commission</TH>
            <TH>Partner Incentive</TH>
            <TH>Re-Payment</TH>
            {/* Milestones */}
            <TH>C0</TH>
            <TH>C1</TH>
            <TH>C2</TH>
            <TH>Adjusted C2</TH>
            <TH>C0 Paid</TH>
            <TH>C1 Paid</TH>
            <TH>C2 Paid</TH>
            <TH>Incentive Paid</TH>
            <TH>Clawback</TH>
            <TH>Others</TH>
            <TH>Total SP Paid</TH>
            <TH>This Week</TH>
            {/* Meta */}
            <TH>Imported At</TH>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const row = r as Record<string, unknown>;
            return (
              <tr key={row.id as number} className="hover:bg-slate-50">
                {/* Identity */}
                <TD>{String(row.payment_date ?? "—")}</TD>
                <TD mono>{String(row.hes_code ?? "—")}</TD>
                <TD><Str v={row.customer_name} /></TD>
                <TD><Str v={row.sales_partner} /></TD>
                <TD><Str v={row.sales_advisor} /></TD>
                <TD><Str v={row.channel} /></TD>
                <TD><Str v={row.status} /></TD>
                <TD>
                  {row.project_id ? (
                    <Link
                      href={`/projects/${row.project_id}`}
                      className="font-medium text-cyan-700 hover:underline"
                    >
                      Yes
                    </Link>
                  ) : (
                    <span className="text-amber-600">Unlinked</span>
                  )}
                </TD>
                {/* Contract */}
                <TD><Str v={row.latest_contract} /></TD>
                <TD><Str v={row.contract_date} /></TD>
                <TD><Str v={row.finance_type} /></TD>
                <TD><Str v={row.financier} /></TD>
                <TD><Str v={row.utility_provider} /></TD>
                {/* Pricing */}
                <TD><Num v={row.pv_size} /></TD>
                <TD><Money v={row.redline_price_tier} /></TD>
                <TD><Money v={row.contract_amount} /></TD>
                <TD><Money v={row.gross_ppw} /></TD>
                <TD><Money v={row.finance_fee} /></TD>
                <TD><Money v={row.cash_deal_value} /></TD>
                <TD><Money v={row.battery_price} /></TD>
                <TD><Money v={row.adder_amount} /></TD>
                <TD><Str v={row.contract_adder_detail} /></TD>
                <TD><Money v={row.post_sale_adder_work_order} /></TD>
                <TD><Money v={row.post_sale_adders} /></TD>
                <TD><Money v={row.pv_only_price} /></TD>
                <TD><Money v={row.ppw} /></TD>
                {/* Incentives */}
                <TD><Money v={row.down_payment} /></TD>
                <TD><Money v={row.spif} /></TD>
                <TD><Money v={row.tpo_rebate} /></TD>
                <TD><Money v={row.etqa} /></TD>
                <TD><Money v={row.enfin_dca} /></TD>
                <TD><Money v={row.light_reach_dca} /></TD>
                {/* Commission */}
                <TD><Money v={row.partner_commission} /></TD>
                <TD><Money v={row.partner_incentive} /></TD>
                <TD><Money v={row.re_payment} /></TD>
                {/* Milestones */}
                <TD><Money v={row.c0} /></TD>
                <TD><Money v={row.c1} /></TD>
                <TD><Money v={row.c2} /></TD>
                <TD><Money v={row.adjusted_c2} /></TD>
                <TD><Money v={row.c0_paid} /></TD>
                <TD><Money v={row.c1_paid} /></TD>
                <TD><Money v={row.c2_paid} /></TD>
                <TD><Money v={row.incentive_paid} /></TD>
                <TD><Money v={row.clawback} /></TD>
                <TD><Money v={row.others} /></TD>
                <TD><Money v={row.total_sp_paid} /></TD>
                <TD><Money v={row.payment_this_week} /></TD>
                {/* Meta */}
                <TD>
                  {row.imported_at
                    ? new Date(String(row.imported_at)).toLocaleDateString()
                    : "—"}
                </TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
