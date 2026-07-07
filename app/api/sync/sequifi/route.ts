import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import { runSequifiSync } from "@/lib/sequifi/sync";
import { invalidatePublicDealsCache } from "@/lib/public-deals/client";

// Apply sync pushes ~900+ records; default Vercel limit (10–60s) is too short.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dryRun = false;
  try {
    const body = (await request.json()) as { dryRun?: boolean };
    dryRun = body.dryRun === true;
  } catch {
    /* default apply */
  }

  const result = await runSequifiSync({ dryRun });
  if ("error" in result) {
    return NextResponse.json(result, { status: 500 });
  }

  if (!dryRun) {
    invalidatePublicDealsCache();
    revalidatePath("/dashboard");
    revalidatePath("/projects");
  }

  return NextResponse.json(result);
}
