"use server";

import { revalidatePath } from "next/cache";
import {
  runSequifiSync,
  type SequifiSyncResponse,
  type SequifiSyncResult,
} from "@/lib/sequifi/sync";

export type { SequifiSyncResponse, SequifiSyncResult };

/** Preview only — fast enough for a server action. Apply uses POST /api/sync/sequifi. */
export async function syncWithSequifi({
  dryRun,
}: {
  dryRun: boolean;
}): Promise<SequifiSyncResponse> {
  const result = await runSequifiSync({ dryRun });
  if (!("error" in result) && !dryRun) {
    revalidatePath("/projects");
  }
  return result;
}
