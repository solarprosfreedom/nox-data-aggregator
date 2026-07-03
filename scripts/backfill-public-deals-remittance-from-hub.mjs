/**
 * Backfill latest Hub remittance values into the public deals endpoints.
 *
 * Dry-run:
 *   node scripts/backfill-public-deals-remittance-from-hub.mjs --vendor=axia
 *
 * Apply:
 *   node scripts/backfill-public-deals-remittance-from-hub.mjs --vendor=axia --apply
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const vendorArg = process.argv.find((arg) => arg.startsWith("--vendor="));
const ONLY_VENDOR = vendorArg?.split("=")[1]?.trim().toLowerCase() ?? null;

const BASE = process.env.PUBLIC_DEALS_API_BASE ?? "https://hub.noxpwr.com/api/public/deals";
const API_KEY = process.env.PUBLIC_DEALS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY) throw new Error("Missing PUBLIC_DEALS_API_KEY");
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase env");

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const REMITTANCE_KEYS = [
  "payment_date",
  "customer_name",
  "status",
  "payment_status",
  "sales_partner",
  "sales_advisor",
  "channel",
  "latest_contract",
  "contract_date",
  "finance_type",
  "financier",
  "utility_provider",
  "pv_size",
  "redline_price_tier",
  "contract_amount",
  "gross_ppw",
  "finance_fee",
  "cash_deal_value",
  "battery_price",
  "adder_amount",
  "contract_adder_detail",
  "post_sale_adder_work_order",
  "post_sale_adders",
  "pv_only_price",
  "ppw",
  "down_payment",
  "spif",
  "tpo_rebate",
  "etqa",
  "enfin_dca",
  "light_reach_dca",
  "partner_commission",
  "partner_incentive",
  "re_payment",
  "c0",
  "c1",
  "c2",
  "adjusted_c2",
  "c0_paid",
  "c1_paid",
  "c2_paid",
  "incentive_paid",
  "clawback",
  "others",
  "total_sp_paid",
  "payment_this_week",
];

const MONEY_KEYS = new Set([
  "pv_size",
  "redline_price_tier",
  "contract_amount",
  "gross_ppw",
  "finance_fee",
  "cash_deal_value",
  "battery_price",
  "adder_amount",
  "post_sale_adder_work_order",
  "post_sale_adders",
  "pv_only_price",
  "ppw",
  "down_payment",
  "spif",
  "tpo_rebate",
  "etqa",
  "enfin_dca",
  "light_reach_dca",
  "partner_commission",
  "partner_incentive",
  "re_payment",
  "c0",
  "c1",
  "c2",
  "adjusted_c2",
  "c0_paid",
  "c1_paid",
  "c2_paid",
  "incentive_paid",
  "clawback",
  "others",
  "total_sp_paid",
  "payment_this_week",
]);

const VENDORS = {
  axia: "Axia Solar Corp",
  illum: "Illum",
  tron: "Tron Solar",
  empwr: "Empwr Solar",
  goodpwr: "GoodPWR",
  owe: "Our World Energy",
};

function compactRemittance(row) {
  const out = {};
  for (const key of REMITTANCE_KEYS) {
    const value = row[key];
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function hasValues(row) {
  return Object.keys(row).length > 0;
}

function normalizedValue(key, value) {
  if (value == null || value === "") return null;
  if (MONEY_KEYS.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value);
}

function differs(endpointRemittance, patch) {
  for (const [key, value] of Object.entries(patch)) {
    const left = normalizedValue(key, endpointRemittance?.[key]);
    const right = normalizedValue(key, value);
    if (MONEY_KEYS.has(key)) {
      if (left == null && right == null) continue;
      if (Math.abs(Number(left) - Number(right)) > 0.000001) return true;
    } else if (left !== right) {
      return true;
    }
  }
  return false;
}

async function fetchEndpointRows(vendor) {
  const response = await fetch(`${BASE}/${vendor}?limit=5000`, {
    headers: { "x-api-key": API_KEY, accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${vendor} GET failed ${response.status}: ${await response.text()}`);
  }
  const body = await response.json();
  return body.data ?? [];
}

async function fetchLatestRemittanceForInstaller(installer) {
  const { data: projects, error: projectError } = await db
    .from("projects")
    .select("id,project_id,installer")
    .eq("installer", installer)
    .limit(5000);
  if (projectError) throw projectError;

  const projectByUuid = new Map(projects.map((project) => [project.id, project]));
  const remittanceRows = [];

  for (let i = 0; i < projects.length; i += 200) {
    const ids = projects.slice(i, i + 200).map((project) => project.id);
    const { data, error } = await db.rpc("latest_remittance_for_projects", { project_ids: ids });
    if (error) throw error;
    remittanceRows.push(...(data ?? []));
  }

  return remittanceRows
    .map((row) => ({ project: projectByUuid.get(row.project_id), remittance: compactRemittance(row) }))
    .filter((item) => item.project?.project_id && hasValues(item.remittance));
}

async function patchEndpoint(vendor, projectId, remittance) {
  const response = await fetch(`${BASE}/${vendor}?id=${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: {
      "x-api-key": API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      project: { project_id: projectId },
      remittance,
    }),
  });
  if (!response.ok) {
    throw new Error(`${vendor} PATCH ${projectId} failed ${response.status}: ${await response.text()}`);
  }
}

async function main() {
  const vendors = Object.keys(VENDORS).filter((vendor) => !ONLY_VENDOR || vendor === ONLY_VENDOR);
  if (vendors.length === 0) throw new Error(`Unknown vendor: ${ONLY_VENDOR}`);

  for (const vendor of vendors) {
    const installer = VENDORS[vendor];
    const endpointRows = await fetchEndpointRows(vendor);
    const endpointByPk = new Map(endpointRows.map((row) => [row.pk_value, row]));
    const hubRows = await fetchLatestRemittanceForInstaller(installer);

    let missingEndpoint = 0;
    let alreadySame = 0;
    const toPatch = [];

    for (const item of hubRows) {
      const projectId = item.project.project_id;
      const endpointRow = endpointByPk.get(projectId);
      if (!endpointRow) {
        missingEndpoint++;
        continue;
      }
      if (differs(endpointRow.remittance ?? {}, item.remittance)) {
        toPatch.push({ projectId, remittance: item.remittance });
      } else {
        alreadySame++;
      }
    }

    console.log(
      `${vendor}: endpointRows=${endpointRows.length} hubRemittanceRows=${hubRows.length} toPatch=${toPatch.length} alreadySame=${alreadySame} missingEndpoint=${missingEndpoint}`,
    );

    if (APPLY) {
      let patched = 0;
      for (const item of toPatch) {
        await patchEndpoint(vendor, item.projectId, item.remittance);
        patched++;
        if (patched % 25 === 0) console.log(`${vendor}: patched ${patched}/${toPatch.length}`);
      }
      console.log(`${vendor}: patched=${patched}`);
    }
  }

  if (!APPLY) console.log("Dry run only. Re-run with --apply to write endpoint remittance.");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
