import { NextRequest, NextResponse } from "next/server";
import { listEndpointProjects } from "@/lib/data-hub/queries";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = keys.join(",");
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(","));
  return [header, ...body].join("\r\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? undefined;

  let rows = (await listEndpointProjects())
    .filter((project) => project.remittance)
    .map((project) => ({
      payment_date: project.remittance?.payment_date,
      hes_code: project.project_id,
      customer_name: project.remittance?.customer_name ?? project.opportunity_name,
      sales_partner: project.remittance?.sales_partner,
      sales_advisor: project.remittance?.sales_advisor,
      channel: project.remittance?.channel,
      status: project.remittance?.status,
      payment_status: project.remittance?.payment_status,
      latest_contract: project.remittance?.latest_contract,
      contract_date: project.remittance?.contract_date,
      finance_type: project.remittance?.finance_type,
      financier: project.remittance?.financier,
      utility_provider: project.remittance?.utility_provider,
      pv_size: project.remittance?.pv_size,
      redline_price_tier: project.remittance?.redline_price_tier,
      contract_amount: project.remittance?.contract_amount,
      gross_ppw: project.remittance?.gross_ppw,
      finance_fee: project.remittance?.finance_fee,
      cash_deal_value: project.remittance?.cash_deal_value,
      battery_price: project.remittance?.battery_price,
      adder_amount: project.remittance?.adder_amount,
      contract_adder_detail: project.remittance?.contract_adder_detail,
      post_sale_adder_work_order: project.remittance?.post_sale_adder_work_order,
      post_sale_adders: project.remittance?.post_sale_adders,
      pv_only_price: project.remittance?.pv_only_price,
      ppw: project.remittance?.ppw,
      down_payment: project.remittance?.down_payment,
      spif: project.remittance?.spif,
      tpo_rebate: project.remittance?.tpo_rebate,
      etqa: project.remittance?.etqa,
      enfin_dca: project.remittance?.enfin_dca,
      light_reach_dca: project.remittance?.light_reach_dca,
      partner_commission: project.remittance?.partner_commission,
      partner_incentive: project.remittance?.partner_incentive,
      re_payment: project.remittance?.re_payment,
      c0: project.remittance?.c0,
      c1: project.remittance?.c1,
      c2: project.remittance?.c2,
      adjusted_c2: project.remittance?.adjusted_c2,
      c0_paid: project.remittance?.c0_paid,
      c1_paid: project.remittance?.c1_paid,
      c2_paid: project.remittance?.c2_paid,
      incentive_paid: project.remittance?.incentive_paid,
      clawback: project.remittance?.clawback,
      others: project.remittance?.others,
      total_sp_paid: project.remittance?.total_sp_paid,
      payment_this_week: project.remittance?.payment_this_week,
      imported_at: project.remittance?.imported_at,
    }))
    .sort((a, b) => String(b.payment_date ?? "").localeCompare(String(a.payment_date ?? "")));

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((row) =>
      [row.hes_code, row.customer_name].some((value) =>
        String(value ?? "").toLowerCase().includes(needle),
      ),
    );
  }

  const csv = toCSV(rows as Record<string, unknown>[]);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="remittance-${date}.csv"`,
    },
  });
}
