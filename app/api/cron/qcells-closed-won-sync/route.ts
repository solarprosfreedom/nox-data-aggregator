import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, shouldExecuteCron } from "@/lib/cron/authorize";
import { runQcellsClosedWonSync } from "@/lib/qcells/closed-won-sync";
import { invalidatePublicDealsCache } from "@/lib/public-deals/client";
import { recordPublicImportLog } from "@/lib/public-imports/client";

export const runtime = "nodejs";
export const maxDuration = 300;

async function runSync(dryRun: boolean) {
  try {
    const result = await runQcellsClosedWonSync({ dryRun });
    if (!dryRun) {
      await recordPublicImportLog({
        source: "axia",
        row_count: result.fetched,
        inserted_count: result.inserted,
        updated_count: result.updated,
        filename: "Qcells Closed Won portal sync",
        trigger_source: "cron",
        error: result.errors.map((item) => item.message).join("; ") || undefined,
      });
      revalidatePath("/imports/history");
    }
    if (!dryRun && (result.inserted > 0 || result.updated > 0)) {
      invalidatePublicDealsCache();
      revalidatePath("/dashboard");
      revalidatePath("/projects");
    }
    return NextResponse.json(
      { ok: result.errors.length === 0, ...result },
      { status: result.errors.length === 0 ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Qcells Closed Won sync failed" },
      { status: 500 },
    );
  }
}

/** Vercel calls this daily. It fresh-logs into Qcells and only syncs Closed Won opportunities. */
export async function GET(request: NextRequest) {
  if (!shouldExecuteCron(request)) {
    return NextResponse.json({
      ok: true,
      path: "/api/cron/qcells-closed-won-sync",
      schedule: "30 2 * * *",
    });
  }
  return runSync(request.nextUrl.searchParams.get("dry_run") === "1");
}

/** Allows an authorized operator to run the identical sync, including dry-run mode. */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync(request.nextUrl.searchParams.get("dry_run") === "1");
}
