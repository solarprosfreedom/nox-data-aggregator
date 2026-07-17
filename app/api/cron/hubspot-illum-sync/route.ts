import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, shouldExecuteCron } from "@/lib/cron/authorize";
import { runHubSpotIllumSync } from "@/lib/hubspot/illum-sync";

export async function GET(request: NextRequest) {
  if (!shouldExecuteCron(request)) {
    return NextResponse.json({
      ok: true,
      path: "/api/cron/hubspot-illum-sync",
      schedule: "*/15 * * * *",
    });
  }

  const fullRefresh = request.nextUrl.searchParams.get("full_refresh") === "1";

  try {
    const result = await runHubSpotIllumSync({ fullRefresh });
    return NextResponse.json({ ok: true, full_refresh: fullRefresh, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot sync failed";
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : undefined;
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fullRefresh = request.nextUrl.searchParams.get("full_refresh") === "1";

  try {
    const result = await runHubSpotIllumSync({ fullRefresh });
    return NextResponse.json({ ok: true, full_refresh: fullRefresh, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "HubSpot sync failed";
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : undefined;
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
