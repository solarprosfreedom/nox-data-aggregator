import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCronAuthorized, shouldExecuteCron } from "@/lib/cron/authorize";
import { invalidatePublicDealsCache } from "@/lib/public-deals/client";
import { runSequifiSync } from "@/lib/sequifi/sync";

// A full endpoint-to-Sequifi push can take longer than the default function limit.
export const maxDuration = 300;

async function syncSequifi() {
  const result = await runSequifiSync({ dryRun: false });
  if ("error" in result) {
    return NextResponse.json(result, { status: 500 });
  }

  invalidatePublicDealsCache();
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return NextResponse.json({ ok: true, ...result });
}

/** Vercel calls this once a day at 02:00 UTC (10:00 AM Asia/Manila). */
export async function GET(request: NextRequest) {
  if (!shouldExecuteCron(request)) {
    return NextResponse.json({
      ok: true,
      path: "/api/cron/sequifi-sync",
      schedule: "0 2 * * *",
    });
  }

  return syncSequifi();
}

/** Allows an authenticated operator to run the same scheduled job manually. */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return syncSequifi();
}
