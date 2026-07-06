import { NextRequest, NextResponse } from "next/server";
import { listEndpointProjects } from "@/lib/data-hub/queries";

function verifyApiKey(request: NextRequest): boolean {
  const expected = process.env.DATA_HUB_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("x-api-key")?.trim();
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return header === expected || auth === expected;
}

export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") ?? 50)));
  const updatedSince = searchParams.get("updated_since");
  const stage = searchParams.get("project_stage");

  const from = (page - 1) * perPage;

  try {
    let rows = await listEndpointProjects();

    if (updatedSince) {
      const cutoff = new Date(updatedSince).getTime();
      if (!Number.isNaN(cutoff)) {
        rows = rows.filter((row) => new Date(row.updated_at).getTime() >= cutoff);
      }
    }
    if (stage) {
      rows = rows.filter((row) => row.project_stage === stage);
    }

    rows = rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const total = rows.length;
    const data = rows.slice(from, from + perPage);

    const projects = data.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id,
        project_id: r.project_id,
        opportunity_name: r.opportunity_name,
        contact: {
          email: r.email,
          phone: r.phone,
          first_name: r.first_name,
          last_name: r.last_name,
        },
        address: {
          line1: r.address_line1,
          city: r.city,
          state: r.state_code,
          zip: r.postal_code,
        },
        stage: {
          project_stage: r.project_stage,
        },
        sales: {
          sales_advisor: {
            name: r.sales_advisor_name,
            email: r.sales_advisor_email,
          },
          setter: { name: r.setter_name, email: r.setter_email },
          closer: { name: r.closer_name, email: r.closer_email },
        },
        system: {
          total_system_cost: r.total_system_cost,
          system_size_kw: r.system_size_kw,
          contract_signed_date: r.contract_signed_date,
        },
        external_ids: {
          terros_account_id: r.terros_account_id,
          sequifi_sale_id: r.sequifi_sale_id,
        },
        org: {
          market: r.market,
          team: r.team,
          region: r.region,
          division: r.division,
          dealer_name: r.dealer_name,
          office_name: r.office_name,
        },
        updated_at: r.updated_at,
      };
    });

    return NextResponse.json({
      data: projects,
      page,
      per_page: perPage,
      total,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
