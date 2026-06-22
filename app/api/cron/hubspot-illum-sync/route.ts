import { NextRequest, NextResponse } from "next/server";
import { runHubSpotIllumSync } from "@/lib/hubspot/illum-sync";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return true;

  const fromBearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const fromHeader = request.headers.get("x-cron-secret")?.trim();
  return fromBearer === expected || fromHeader === expected;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    path: "/api/cron/hubspot-illum-sync",
    schedule: "*/15 * * * *",
    note: "POST to execute sync",
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fullRefresh = request.nextUrl.searchParams.get("full_refresh") === "1";

  try {
    const result = await runHubSpotIllumSync({ fullRefresh });
    return NextResponse.json({
      ok: true,
      full_refresh: fullRefresh,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HubSpot sync failed" },
      { status: 500 },
    );
  }
}
