import type { SequifiSyncResponse } from "@/lib/sequifi/sync";

/** Apply sync via API route (5 min timeout). Preview uses the server action instead. */
export async function applySequifiSync(): Promise<SequifiSyncResponse> {
  const res = await fetch("/api/sync/sequifi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRun: false }),
  });

  const data = (await res.json()) as SequifiSyncResponse;
  if (!res.ok && "error" in data) return data;
  if (!res.ok) return { error: `Sync failed (${res.status})` };
  return data;
}
