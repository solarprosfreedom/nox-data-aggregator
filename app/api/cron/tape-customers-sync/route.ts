import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, shouldExecuteCron } from "@/lib/cron/authorize";
import { runTapeCustomersSync } from "@/lib/tape/customers-sync";

export async function GET(request: NextRequest) {
  if (!shouldExecuteCron(request)) {
    return NextResponse.json({
      ok: true,
      path: "/api/cron/tape-customers-sync",
      schedule: "3,18,33,48 * * * *",
    });
  }

  try {
    const result = await runTapeCustomersSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tape customers sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTapeCustomersSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tape customers sync failed" },
      { status: 500 },
    );
  }
}
