import { NextRequest, NextResponse } from "next/server";
import { customerDisplayName, resolveStateCode } from "@/lib/data-hub/normalize";
import { listProjectsPaged } from "@/lib/data-hub/queries";
import {
  legacyParamsToColumnFilters,
  mergeColumnFilters,
  parseColumnFilters,
} from "@/lib/data-hub/column-filters";

// Latest-remittance fields promoted onto each project row (prefixed in the CSV).
const REMITTANCE_EXPORT_COLUMNS = [
  "payment_date", "status", "payment_status", "sales_partner", "channel", "latest_contract",
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
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? undefined;
  const installer = searchParams.get("installer")?.trim() ?? "";
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of searchParams.entries()) params[key] = value;
  const columnFilters = mergeColumnFilters(
    parseColumnFilters(params),
    legacyParamsToColumnFilters({
      installer: installer || undefined,
      setter: searchParams.get("setter") ?? undefined,
      salesRep: searchParams.get("salesRep") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    }),
  );

  const { rows: projects } = await listProjectsPaged({
    page: 1,
    pageSize: 50000,
    search: q,
    installer: installer || undefined,
    setter: searchParams.get("setter") ?? undefined,
    salesRep: searchParams.get("salesRep") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    columnFilters,
    sort: "updated_at",
    sortDir: "desc",
  });

  const merged = projects.map((p, i) => {
    const { id: _id, remittance, ...rest } = p;
    const remit = remittance as Record<string, unknown> | null;
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
