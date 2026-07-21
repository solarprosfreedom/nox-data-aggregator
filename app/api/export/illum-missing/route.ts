import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  buildIllumMissingExportRows,
  illumMissingRowsToCsv,
} from "@/lib/data-hub/illum-missing-export";
import { listPublicDeals } from "@/lib/public-deals/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const deals = await listPublicDeals("illum");
  const rows = buildIllumMissingExportRows(deals);
  const csv = illumMissingRowsToCsv(rows);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="illum-missing-data-${date}.csv"`,
    },
  });
}
