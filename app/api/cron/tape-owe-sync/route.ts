import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, shouldExecuteCron } from "@/lib/cron/authorize";
import { runTapeOweSync } from "@/lib/tape/owe-sync";

export async function GET(request: NextRequest) {
  if (!shouldExecuteCron(request)) {
    return NextResponse.json({
      ok: true,
      path: "/api/cron/tape-owe-sync",
      schedule: "7,22,37,52 * * * *",
    });
  }

  try {
    const result = await runTapeOweSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tape OWE sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTapeOweSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tape OWE sync failed" },
      { status: 500 },
    );
  }
}
