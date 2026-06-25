import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
  const db = createServerSupabase();

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? undefined;

  let query = db
    .from("remittance")
    .select(
      "payment_date, hes_code, customer_name, sales_partner, sales_advisor, channel, status, payment_status, latest_contract, contract_date, finance_type, financier, utility_provider, pv_size, redline_price_tier, contract_amount, gross_ppw, finance_fee, cash_deal_value, battery_price, adder_amount, contract_adder_detail, post_sale_adder_work_order, post_sale_adders, pv_only_price, ppw, down_payment, spif, tpo_rebate, etqa, enfin_dca, light_reach_dca, partner_commission, partner_incentive, re_payment, c0, c1, c2, adjusted_c2, c0_paid, c1_paid, c2_paid, incentive_paid, clawback, others, total_sp_paid, payment_this_week, imported_at"
    )
    .order("payment_date", { ascending: false })
    .limit(50000);

  if (q) {
    query = query.or(
      `hes_code.ilike.%${q}%,customer_name.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCSV((data ?? []) as Record<string, unknown>[]);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="remittance-${date}.csv"`,
    },
  });
}
