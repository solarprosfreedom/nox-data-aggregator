import { NextRequest, NextResponse } from "next/server";
import { runTapeOweSync } from "@/lib/tape/owe-sync";

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
    path: "/api/cron/tape-owe-sync",
    schedule: "7,22,37,52 * * * *",
    note: "POST to execute sync",
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTapeOweSync();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tape OWE sync failed" },
      { status: 500 },
    );
  }
}
