import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCronAuthorized, shouldExecuteCron } from "@/lib/cron/authorize";
import { runCoperniqTronSync } from "@/lib/coperniq/tron-sync";
import { invalidatePublicDealsCache } from "@/lib/public-deals/client";
import { recordPublicImportLog } from "@/lib/public-imports/client";

export const maxDuration = 300;

async function syncCoperniqTron() {
  try {
    const result = await runCoperniqTronSync({ dryRun: false });
    await recordPublicImportLog({
      source: "tron",
      row_count: result.fetched,
      inserted_count: result.inserted,
      updated_count: result.updated,
      filename: "Coperniq API /v1/projects",
      trigger_source: "cron",
      error: result.errors.map((item) => item.message).join("; ") || undefined,
    });
    invalidatePublicDealsCache();
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/imports/history");
    return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status: result.errors.length ? 500 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coperniq Tron sync failed" },
      { status: 500 },
    );
  }
}

/** Vercel calls this every 15 minutes; full pagination keeps the source and Lovable synchronized. */
export async function GET(request: NextRequest) {
  if (!shouldExecuteCron(request)) {
    return NextResponse.json({
      ok: true,
      path: "/api/cron/coperniq-tron-sync",
      schedule: "12,27,42,57 * * * *",
    });
  }
  return syncCoperniqTron();
}

/** Allows an authenticated operator to run the same sync manually. */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return syncCoperniqTron();
}
