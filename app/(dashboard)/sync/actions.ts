"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildIndex,
  matchProject,
  ownerEmailFromRaw,
  closerEmailFromRaw,
  type TerrosAccountRow,
} from "@/lib/terros/matcher";
import { listEndpointProjects } from "@/lib/data-hub/queries";
import { patchPublicDealFromHub } from "@/lib/data-hub/public-deals-sync";

export type SyncResult = {
  projectsScanned: number;
  terrosAccounts: number;
  matched: number;
  matchedByEmail: number;
  matchedByPhone: number;
  matchedByAddress: number;
  updated: number;
  filled: number;
  changed: number;
  noSetterInTerros: number;
  unmatched: number;
  errors: number;
  errorMessages: string[];
};

export type SyncSettersResult = SyncResult | { error: string };

// Load every terros_accounts row in pages (Supabase caps each request at 1000).
async function loadAllTerrosAccounts(
  db: ReturnType<typeof createServerSupabase>
): Promise<TerrosAccountRow[]> {
  const all: TerrosAccountRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("terros_accounts")
      .select(
        "account_id, email, phone, address_line1, postal_code, setter_name, setter_email, closer_name, raw_terros"
      )
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TerrosAccountRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export async function syncSettersFromTerros(): Promise<SyncSettersResult> {
  const stats: SyncResult = {
    projectsScanned: 0,
    terrosAccounts: 0,
    matched: 0,
    matchedByEmail: 0,
    matchedByPhone: 0,
    matchedByAddress: 0,
    updated: 0,
    filled: 0,
    changed: 0,
    noSetterInTerros: 0,
    unmatched: 0,
    errors: 0,
    errorMessages: [],
  };

  try {
    const db = createServerSupabase();

    // 1. Load locally-synced Terros accounts and build the lookup index.
    const terrosAccounts = await loadAllTerrosAccounts(db);
    stats.terrosAccounts = terrosAccounts.length;
    const index = buildIndex(terrosAccounts);

    // 2. Load all endpoint projects.
    const projects = await listEndpointProjects();
    stats.projectsScanned = projects.length;

    // 3. Match each project and overwrite setter/closer from Terros on a hit.
    for (const project of projects) {
      const result = matchProject(project, index);
      if (!result) {
        stats.unmatched++;
        continue;
      }

      const { account, matchedBy } = result;
      stats.matched++;
      if (matchedBy === "email") stats.matchedByEmail++;
      if (matchedBy === "phone") stats.matchedByPhone++;
      if (matchedBy === "address") stats.matchedByAddress++;

      const setterName = account.setter_name?.trim() || null;
      if (!setterName) {
        stats.noSetterInTerros++;
        continue;
      }

      const setterEmail = account.setter_email?.trim() || ownerEmailFromRaw(account.raw_terros);
      const closerName = account.closer_name?.trim() || null;
      const closerEmail = closerEmailFromRaw(account.raw_terros);
      const terrosId = account.account_id ?? null;

      const update: Record<string, unknown> = {
        setter_name: setterName,
        terros_account_id: terrosId,
      };
      if (setterEmail) update.setter_email = setterEmail;
      if (closerName) update.closer_name = closerName;
      if (closerEmail) update.closer_email = closerEmail;

      // Skip the write when nothing actually changes.
      const unchanged =
        project.setter_name === setterName &&
        project.terros_account_id === terrosId &&
        (setterEmail == null || project.setter_email === setterEmail) &&
        (closerName == null || project.closer_name === closerName) &&
        (closerEmail == null || project.closer_email === closerEmail);
      if (unchanged) continue;

      const hadSetter = Boolean(project.setter_name?.trim());

      try {
        await patchPublicDealFromHub({
          installer: project.installer,
          project: {
            project_id: project.project_id,
            ...update,
          },
        });
      } catch (err) {
        stats.errors++;
        if (stats.errorMessages.length < 10) {
          stats.errorMessages.push(
            `${project.project_id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        continue;
      }

      stats.updated++;
      if (hadSetter) stats.changed++;
      else stats.filled++;
    }

    revalidatePath("/projects");
    return stats;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed." };
  }
}
