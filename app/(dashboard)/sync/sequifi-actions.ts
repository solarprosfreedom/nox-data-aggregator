"use server";

import { revalidatePath } from "next/cache";
import {
  runSequifiSync,
  type SequifiSyncResponse,
  type SequifiSyncResult,
} from "@/lib/sequifi/sync";
import { invalidatePublicDealsCache } from "@/lib/public-deals/client";

export type { SequifiSyncResponse, SequifiSyncResult };

/** Preview only — fast enough for a server action. Apply uses POST /api/sync/sequifi. */
export async function syncWithSequifi({
  dryRun,
}: {
  dryRun: boolean;
}): Promise<SequifiSyncResponse> {
  const result = await runSequifiSync({ dryRun });
  if (!("error" in result) && !dryRun) {
    invalidatePublicDealsCache();
    revalidatePath("/dashboard");
    revalidatePath("/projects");
  }
  return result;
}
