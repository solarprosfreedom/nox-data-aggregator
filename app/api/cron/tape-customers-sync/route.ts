import { NextRequest, NextResponse } from "next/server";
import { runTapeCustomersSync } from "@/lib/tape/customers-sync";

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
    path: "/api/cron/tape-customers-sync",
    schedule: "3,18,33,48 * * * *",
    note: "POST to execute sync",
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTapeCustomersSync();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tape customers sync failed" },
      { status: 500 },
    );
  }
}
