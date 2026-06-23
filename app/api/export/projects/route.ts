import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { customerDisplayName, resolveStateCode } from "@/lib/data-hub/normalize";

// Latest-remittance fields promoted onto each project row (prefixed in the CSV).
const REMITTANCE_EXPORT_COLUMNS = [
  "payment_date", "status", "sales_partner", "channel", "latest_contract",
  "contract_date", "finance_type", "financier", "utility_provider", "pv_size",
  "redline_price_tier", "contract_amount", "gross_ppw", "finance_fee",
  "cash_deal_value", "battery_price", "adder_amount", "contract_adder_detail",
  "post_sale_adder_work_order", "post_sale_adders", "pv_only_price", "ppw",
  "down_payment", "spif", "tpo_rebate", "etqa", "enfin_dca", "light_reach_dca",
  "partner_commission", "partner_incentive", "re_payment", "c0", "c1", "c2",
  "adjusted_c2", "c0_paid", "c1_paid", "c2_paid", "incentive_paid", "clawback",
  "others", "total_sp_paid", "payment_this_week",
] as const;

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
  const installer = searchParams.get("installer")?.trim() ?? "";
  const PROJECT_EXPORT_COLUMNS =
    "id, project_id, opportunity_name, first_name, last_name, email, phone, address_line1, city, state_code, postal_code, project_stage, contract_signed_date, total_system_cost, system_size_kw, sales_advisor_name, sales_advisor_email, setter_name, setter_email, closer_name, closer_email, market, team, region, division, dealer_name, office_name, installer, terros_account_id, sequifi_sale_id, updated_at";
  const pageSize = 1000;
  const projects: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let query = db
      .from("projects")
      .select(PROJECT_EXPORT_COLUMNS)
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (q) {
      query = query.or(
        `project_id.ilike.%${q}%,opportunity_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
      );
    }
    if (installer) query = query.eq("installer", installer);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const batch = (data ?? []) as Record<string, unknown>[];
    projects.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  // Attach each project's latest remittance row (by payment_date).
  const ids = projects.map((p) => p.id as string);
  const latestRemit = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data: remitData } = await db
        .from("remittance")
        .select(`project_id, ${REMITTANCE_EXPORT_COLUMNS.join(", ")}`)
        .in("project_id", chunk)
        .order("payment_date", { ascending: false });
      for (const row of (remitData ?? []) as unknown as Record<string, unknown>[]) {
        const pid = row.project_id as string | null;
        if (pid && !latestRemit.has(pid)) latestRemit.set(pid, row);
      }
    }
  }

  const merged = projects.map((p, i) => {
    const { id, ...rest } = p;
    const remit = latestRemit.get(id as string);
    const out: Record<string, unknown> = {
      row_number: i + 1,
      ...rest,
      opportunity_name: customerDisplayName(rest.opportunity_name as string | null),
      state_code: resolveStateCode({
        state_code: rest.state_code as string | null,
        address_line1: rest.address_line1 as string | null,
        opportunity_name: rest.opportunity_name as string | null,
        postal_code: rest.postal_code as string | null,
      }),
    };
    for (const col of REMITTANCE_EXPORT_COLUMNS) {
      out[`remit_${col}`] = remit ? remit[col] ?? null : null;
    }
    return out;
  });

  const csv = toCSV(merged);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-${date}.csv"`,
    },
  });
}
