/**
 * Fetch Terros accounts missing from Supabase terros_accounts.
 *
 * Usage:
 *   node scripts/sync-terros-missing.mjs --all          # full scan (all workflow stages)
 *   node scripts/sync-terros-missing.mjs --stage Closed # scan one exact workflow stage
 *   node scripts/sync-terros-missing.mjs --from 2026-06-01
 *   node scripts/sync-terros-missing.mjs --all --dry-run
 *   node scripts/sync-terros-missing.mjs --all --update-existing
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const PAGE_SIZE = 1000;
const UPSERT_BATCH = 100;
const MIN_GAP_MS = 200;
const JUNE_START_DEFAULT = "2026-06-01T00:00:00.000Z";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allStages = args.includes("--all");
const updateExisting = args.includes("--update-existing") || args.includes("--refresh");
const stageArg = args.find((a, i) => args[i - 1] === "--stage");
const fromArg = args.find((a, i) => args[i - 1] === "--from") ?? JUNE_START_DEFAULT;

const terrosBase = (process.env.TERROS_API_BASE_URL ?? "https://api.terros.com").replace(
  /\/$/,
  ""
);
const terrosKey = process.env.TERROS_API_KEY ?? "";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!terrosKey) throw new Error("Missing TERROS_API_KEY in .env.local");
if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials in .env.local");

const db = createClient(supabaseUrl, supabaseKey);
const rangeStartMs = new Date(fromArg).getTime();
const rangeEndMs = Date.now();

let lastTerrosAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function terrosOk(text) {
  try {
    const j = JSON.parse(text);
    if (j.type === "error") return false;
  } catch {
    /* non-json */
  }
  return true;
}

async function postTerros(path, body) {
  const wait = lastTerrosAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastTerrosAt = Date.now();

  const res = await fetch(`${terrosBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${terrosKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok || !terrosOk(text)) {
    throw new Error(`Terros ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

function normEmail(v) {
  const e = String(v ?? "")
    .trim()
    .toLowerCase();
  return e || null;
}

function normText(v) {
  const t = String(v ?? "").trim();
  return t || null;
}

function personName(person) {
  if (!person || typeof person !== "object") return null;
  const direct = normText(person.name);
  if (direct) return direct;
  return [normText(person.firstName), normText(person.lastName)].filter(Boolean).join(" ") || null;
}

function residentFrom(acc) {
  const resident = acc.resident;
  if (resident && typeof resident === "object" && Object.keys(resident).length > 0) {
    return resident;
  }
  const homeowner = acc.homeowner;
  if (homeowner && typeof homeowner === "object" && Object.keys(homeowner).length > 0) {
    return homeowner;
  }
  return {};
}

function msToIso(v) {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

function mapAccount(acc) {
  const accountId = normText(acc.accountId ?? acc.id);
  if (!accountId) return null;

  const resident = residentFrom(acc);
  const loc = acc.location ?? acc.address ?? {};
  const owner = acc.owner;
  const closer = acc.closer;

  const firstName = normText(resident.firstName);
  const lastName = normText(resident.lastName);

  return {
    account_id: accountId,
    external_lead_id: normText(acc.externalLeadId),
    opportunity_name: personName(resident),
    first_name: firstName,
    last_name: lastName,
    email: normEmail(resident.email),
    phone: normText(resident.phone),
    address_line1: normText(loc.line1 ?? loc.address),
    city: normText(loc.locality ?? loc.city),
    state_code: normText(loc.countrySubd ?? loc.state),
    postal_code: normText(loc.postal1 ?? loc.zip),
    setter_name: personName(owner),
    setter_email: normEmail(owner?.email),
    setter_id: normText(acc.ownerId ?? owner?.userId ?? owner?.id),
    closer_name: personName(closer),
    closer_email: normEmail(closer?.email),
    closer_id: normText(acc.closerId ?? closer?.userId ?? closer?.id),
    workflow_stage_id: normText(acc.workflowStageId),
    workflow_id: normText(acc.workflowId),
    account_source: normText(acc.accountSource),
    source_id: normText(acc.sourceId),
    location_id: normText(acc.locationId),
    company_name: normText(acc.company?.name),
    terros_last_action_at: msToIso(acc.lastActionDate),
    terros_created_at: msToIso(acc.createdDate ?? acc.createdAt),
    raw_terros: acc,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function loadExistingAccountIds() {
  const ids = new Set();
  const pageSize = 1000;
  let from = 0;

  process.stdout.write("Loading Supabase account_ids…");
  while (true) {
    const { data, error } = await db
      .from("terros_accounts")
      .select("account_id")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Supabase load failed: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      if (row.account_id) ids.add(row.account_id);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
    if (from % 10000 === 0) process.stdout.write(` ${ids.size}`);
  }
  console.log(` done (${ids.size.toLocaleString()} ids)`);
  return ids;
}

async function upsertBatch(rows) {
  if (!rows.length) return { error: null };
  const { error } = await db.from("terros_accounts").upsert(rows, {
    onConflict: "account_id",
    ignoreDuplicates: false,
  });
  return { error };
}

async function fetchAllStageIds() {
  const parsed = await postTerros("/workflow/list", { size: 100 });
  const stages = [];
  for (const wf of parsed.workflows ?? []) {
    for (const s of wf.stages ?? []) {
      const id = normText(s.stageId ?? s.id);
      const name = normText(s.name ?? s.label ?? id);
      if (id) stages.push({ id, name });
    }
  }
  return stages;
}

async function* paginateStage(stageId) {
  let sortTimestamp;

  while (true) {
    const parsed = await postTerros("/account/list", {
      size: PAGE_SIZE,
      searchInput: {
        stageIds: [stageId],
        searchByCurrentStage: true,
        sortBy: "lastActionDate",
        sortOrder: "asc",
        ...(sortTimestamp !== undefined ? { sortTimestamp } : {}),
      },
    });

    const rows = parsed.accounts ?? parsed.data ?? [];
    if (!Array.isArray(rows) || rows.length === 0) break;

    yield rows;

    if (rows.length < PAGE_SIZE) break;
    const next = rows[rows.length - 1]?.lastActionDate;
    if (typeof next !== "number") break;
    sortTimestamp = next;
  }
}

async function* paginateByDate(fromMs, toMs) {
  let sortTimestamp = fromMs;

  while (true) {
    const parsed = await postTerros("/account/list", {
      size: PAGE_SIZE,
      searchInput: {
        sortBy: "lastActionDate",
        sortOrder: "asc",
        sortTimestamp,
      },
    });

    const rows = parsed.accounts ?? parsed.data ?? [];
    if (!Array.isArray(rows) || rows.length === 0) break;

    yield rows;

    const lastActionDate = rows[rows.length - 1]?.lastActionDate;
    if (rows.length < PAGE_SIZE) break;
    if (typeof lastActionDate !== "number") break;
    if (lastActionDate >= toMs) break;
    sortTimestamp = lastActionDate;
  }
}

async function processRows(rows, existingIds, seenInRun, stats, label) {
  const toUpsert = [];

  for (const acc of rows) {
    const accountId = normText(acc.accountId ?? acc.id);
    if (!accountId) continue;
    if (seenInRun.has(accountId)) {
      stats.duplicatesSkipped += 1;
      continue;
    }
    seenInRun.add(accountId);

    stats.terrosFetched += 1;

    const exists = existingIds.has(accountId);
    if (exists) {
      stats.alreadyInSupabase += 1;
      if (!updateExisting) continue;
    } else {
      stats.missing += 1;
    }

    const mapped = mapAccount(acc);
    if (mapped) toUpsert.push({ row: mapped, exists });
  }

  if (toUpsert.length && !dryRun) {
    for (let i = 0; i < toUpsert.length; i += UPSERT_BATCH) {
      const batch = toUpsert.slice(i, i + UPSERT_BATCH);
      const { error } = await upsertBatch(batch.map((item) => item.row));
      if (error) {
        stats.failed += batch.length;
        console.error(`Upsert error (${label}): ${error.message}`);
      } else {
        stats.upserted += batch.length;
        for (const item of batch) {
          if (item.exists) stats.updatedExisting += 1;
          else stats.insertedNew += 1;
          existingIds.add(item.row.account_id);
        }
      }
    }
  } else if (toUpsert.length && dryRun) {
    stats.upserted += toUpsert.length;
    for (const item of toUpsert) {
      if (item.exists) stats.updatedExisting += 1;
      else stats.insertedNew += 1;
    }
  }

  if (toUpsert.length > 0) {
    console.log(`${label}: ${toUpsert.length} to upsert (total ${stats.upserted})`);
  }
}

async function syncAllStages(existingIds, seenInRun, stats) {
  const stages = await fetchAllStageIds();
  console.log(`Scanning ${stages.length} workflow stages…`);

  for (const stage of stages) {
    let page = 0;
    for await (const rows of paginateStage(stage.id)) {
      page += 1;
      stats.pages += 1;
      await processRows(rows, existingIds, seenInRun, stats, `${stage.name} p${page}`);
    }
  }
}

async function syncSelectedStage(existingIds, seenInRun, stats, requestedStage) {
  const stageNeedle = requestedStage.trim().toLowerCase();
  if (!stageNeedle) throw new Error("--stage requires an exact stage name or stage ID");

  const stages = await fetchAllStageIds();
  const matches = stages.filter(
    (stage) =>
      stage.id.toLowerCase() === stageNeedle ||
      stage.name.trim().toLowerCase() === stageNeedle
  );

  if (!matches.length) {
    throw new Error(`No Terros workflow stage matched: ${requestedStage}`);
  }

  console.log(
    `Scanning ${matches.length} matching workflow stage${matches.length === 1 ? "" : "s"}: ${matches.map((stage) => stage.name).join(", ")}…`
  );

  for (const stage of matches) {
    let page = 0;
    for await (const rows of paginateStage(stage.id)) {
      page += 1;
      stats.pages += 1;
      await processRows(rows, existingIds, seenInRun, stats, `${stage.name} p${page}`);
    }
  }
}

async function syncDateRange(existingIds, seenInRun, stats) {
  console.log(
    `Scanning lastActionDate ${new Date(rangeStartMs).toISOString()} → ${new Date(rangeEndMs).toISOString()}…`
  );

  let page = 0;
  for await (const rows of paginateByDate(rangeStartMs, rangeEndMs)) {
    page += 1;
    stats.pages += 1;
    const last = rows[rows.length - 1]?.lastActionDate;
    const lastIso = typeof last === "number" ? new Date(last).toISOString() : "n/a";
    await processRows(rows, existingIds, seenInRun, stats, `date p${page} (${lastIso})`);
  }
}

async function main() {
  const scope = stageArg ? `stage: ${stageArg}` : allStages ? "all stages" : "date range";
  console.log(
    `Terros → Supabase sync${dryRun ? " (dry run)" : ""} [${scope}${updateExisting ? ", update existing" : ", insert missing only"}]\n`
  );

  const existingIds = await loadExistingAccountIds();
  const seenInRun = new Set();
  const stats = {
    pages: 0,
    terrosFetched: 0,
    alreadyInSupabase: 0,
    missing: 0,
    upserted: 0,
    insertedNew: 0,
    updatedExisting: 0,
    duplicatesSkipped: 0,
    failed: 0,
  };

  if (stageArg) {
    await syncSelectedStage(existingIds, seenInRun, stats, stageArg);
  } else if (allStages) {
    await syncAllStages(existingIds, seenInRun, stats);
  } else {
    await syncDateRange(existingIds, seenInRun, stats);
  }

  const { count } = await db
    .from("terros_accounts")
    .select("*", { count: "exact", head: true });

  console.log("\nSummary:");
  console.log(JSON.stringify({ ...stats, supabaseTotal: count }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
