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
    .from("projects")
    .select(
      "project_id, opportunity_name, first_name, last_name, email, phone, address_line1, city, state_code, postal_code, project_stage, contract_signed_date, total_system_cost, system_size_kw, sales_advisor_name, sales_advisor_email, setter_name, setter_email, closer_name, closer_email, market, team, region, division, dealer_name, office_name, terros_account_id, sequifi_sale_id, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(10000);

  if (q) {
    query = query.or(
      `project_id.ilike.%${q}%,opportunity_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
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
      "Content-Disposition": `attachment; filename="projects-${date}.csv"`,
    },
  });
}
