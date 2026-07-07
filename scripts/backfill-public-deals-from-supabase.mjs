/**
 * Backfill legacy Supabase project/remittance rows into the public deals
 * endpoint tables. Only rows with meaningful remittance are included.
 * Default is dry-run.
 *
 *   node scripts/backfill-public-deals-from-supabase.mjs
 *   node scripts/backfill-public-deals-from-supabase.mjs --apply
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : null;
const BASE = (process.env.PUBLIC_DEALS_API_BASE ?? "https://hub.noxpwr.com/api/public/deals").replace(/\/$/, "");
const API_KEY = process.env.PUBLIC_DEALS_API_KEY ?? process.env.DATA_HUB_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY) throw new Error("Missing PUBLIC_DEALS_API_KEY or DATA_HUB_API_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const VENDORS = ["axia", "illum", "tron", "empwr", "goodpwr", "owe"];

const PROJECT_COLUMNS = [
  "id",
  "project_id",
  "opportunity_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "address_line1",
  "city",
  "state_code",
  "postal_code",
  "project_stage",
  "contract_signed_date",
  "total_system_cost",
  "system_size_kw",
  "sales_advisor_name",
  "sales_advisor_email",
  "setter_name",
  "setter_email",
  "closer_name",
  "closer_email",
  "installer",
  "updated_at",
];

const REMITTANCE_COLUMNS = [
  "id",
  "project_id",
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
  "imported_at",
];

const REMITTANCE_PAYLOAD_KEYS = REMITTANCE_COLUMNS.filter(
  (key) => !["id", "project_id", "imported_at"].includes(key),
);

const MEANINGFUL_REMITTANCE_KEYS = REMITTANCE_PAYLOAD_KEYS.filter(
  (key) => !["customer_name", "status"].includes(key),
);

function vendorForInstaller(installer) {
  const value = String(installer ?? "").trim();
  if (!value) return null;
  if (/axia/i.test(value)) return "axia";
  if (/illum/i.test(value)) return "illum";
  if (/\bowe\b/i.test(value)) return "owe";
  if (/tron/i.test(value)) return "tron";
  if (/empwr/i.test(value)) return "empwr";
  if (/good\s*pwr|goodpwr/i.test(value)) return "goodpwr";
  return null;
}

function compact(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

function rowUpdatedAt(row) {
  const parsed = Date.parse(String(row.imported_at ?? row.updated_at ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMeaningfulRemittance(row) {
  if (!row) return false;
  return MEANINGFUL_REMITTANCE_KEYS.some((key) => {
    const value = row[key];
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    return true;
  });
}

function projectPayload(project) {
  return compact({
    project_id: project.project_id,
    opportunity_name: project.opportunity_name,
    first_name: project.first_name,
    last_name: project.last_name,
    address_line1: project.address_line1,
    city: project.city,
    state_code: project.state_code,
    postal_code: project.postal_code,
    email: project.email,
    phone: project.phone,
    project_stage: project.project_stage,
    contract_signed_date: project.contract_signed_date,
    total_system_cost: project.total_system_cost,
    system_size_kw: project.system_size_kw,
    sales_advisor_name: project.sales_advisor_name,
    sales_advisor_email: project.sales_advisor_email,
    setter_name: project.setter_name,
    setter_email: project.setter_email,
    closer_name: project.closer_name,
    closer_email: project.closer_email,
    installer: project.installer,
    updated_at: project.updated_at,
  });
}

function remittancePayload(remittance) {
  if (!remittance || !hasMeaningfulRemittance(remittance)) return undefined;
  const payload = {};
  for (const key of REMITTANCE_PAYLOAD_KEYS) payload[key] = remittance[key];
  return compact(payload);
}

function vendorKey(vendor, projectId) {
  if (vendor === "illum" && projectId.startsWith("hubspot_")) {
    return { deal_id: projectId.slice("hubspot_".length) };
  }
  if (vendor === "owe" && projectId.startsWith("tape_owe_")) {
    return { tape_record_id: projectId.slice("tape_owe_".length) };
  }
  return undefined;
}

async function fetchAll(table, columns, orderColumn = "id") {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = db.from(table).select(columns.join(",")).range(from, from + pageSize - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function fetchEndpointRows(vendor) {
  const rows = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ page: String(page), limit: "5000" });
    const response = await fetch(`${BASE}/${vendor}?${params}`, {
      headers: { accept: "application/json", "x-api-key": API_KEY },
    });
    if (!response.ok) {
      throw new Error(`${vendor} GET failed (${response.status}): ${await response.text()}`);
    }
    const body = await response.json();
    const data = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
    rows.push(...data);
    if (!body.hasMore || data.length === 0) break;
    page = (body.page ?? page) + 1;
  }
  return rows;
}

async function putPublicDeal(vendor, payload) {
  const response = await fetch(`${BASE}/${vendor}`, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${vendor} PUT failed (${response.status}): ${await response.text()}`);
  }
}

async function main() {
  console.log(APPLY ? "*** APPLY MODE — writing to public deals endpoints ***" : "*** DRY RUN — no endpoint writes ***");

  const [projects, remittanceRows] = await Promise.all([
    fetchAll("projects", PROJECT_COLUMNS, "project_id"),
    fetchAll("remittance", REMITTANCE_COLUMNS, "id"),
  ]);

  const latestRemittanceByProject = new Map();
  for (const row of remittanceRows) {
    const projectId = row.project_id;
    if (!projectId) continue;
    const previous = latestRemittanceByProject.get(projectId);
    if (!previous || rowUpdatedAt(row) >= rowUpdatedAt(previous)) {
      latestRemittanceByProject.set(projectId, row);
    }
  }

  const endpointIdsByVendor = new Map();
  for (const vendor of VENDORS) {
    const rows = await fetchEndpointRows(vendor);
    endpointIdsByVendor.set(
      vendor,
      new Set(
        rows
          .map((row) => String(row.project?.project_id ?? row.pk_value ?? "").trim())
          .filter(Boolean),
      ),
    );
  }

  const summary = {
    supabaseProjects: projects.length,
    supported: 0,
    skippedNoProjectId: 0,
    skippedUnsupportedInstaller: 0,
    skippedNoRemittance: 0,
    wouldUpdate: 0,
    wouldInsert: 0,
    withRemittance: 0,
    applied: 0,
    errors: 0,
  };
  const byVendor = new Map(VENDORS.map((vendor) => [vendor, { total: 0, update: 0, insert: 0 }]));
  const plans = [];

  for (const project of projects) {
    if (LIMIT && plans.length >= LIMIT) break;
    const projectId = String(project.project_id ?? "").trim();
    if (!projectId) {
      summary.skippedNoProjectId++;
      continue;
    }

    const vendor = vendorForInstaller(project.installer);
    if (!vendor) {
      summary.skippedUnsupportedInstaller++;
      continue;
    }

    const projectPatch = projectPayload(project);
    if (!projectPatch.project_id) {
      summary.skippedNoProjectId++;
      continue;
    }

    const remittance = remittancePayload(latestRemittanceByProject.get(project.id));
    if (!remittance) {
      summary.skippedNoRemittance++;
      continue;
    }

    const existing = endpointIdsByVendor.get(vendor)?.has(projectId) ?? false;
    const action = existing ? "update" : "insert";
    const vendorStats = byVendor.get(vendor);

    summary.supported++;
    if (existing) summary.wouldUpdate++;
    else summary.wouldInsert++;
    summary.withRemittance++;
    vendorStats.total++;
    vendorStats[action]++;

    plans.push({
      vendor,
      action,
      payload: {
        vendor_key: vendorKey(vendor, projectId),
        project: projectPatch,
        remittance,
        source: {
          file_name: "supabase-backfill",
          raw_row: {
            supabase_project_id: project.id,
            supabase_remittance_id: latestRemittanceByProject.get(project.id)?.id ?? null,
          },
        },
      },
    });
  }

  for (const vendor of VENDORS) {
    const stats = byVendor.get(vendor);
    console.log(
      `${vendor.padEnd(7)} withRemittance=${String(stats.total).padStart(4)} update=${String(stats.update).padStart(4)} insert=${String(stats.insert).padStart(4)}`,
    );
  }

  console.log(
    `SUMMARY supabaseProjects=${summary.supabaseProjects} withRemittance=${summary.withRemittance} update=${summary.wouldUpdate} insert=${summary.wouldInsert} skippedNoRemittance=${summary.skippedNoRemittance} skippedNoProjectId=${summary.skippedNoProjectId} skippedUnsupportedInstaller=${summary.skippedUnsupportedInstaller}`,
  );

  if (!APPLY) return;

  for (const plan of plans) {
    try {
      await putPublicDeal(plan.vendor, plan.payload);
      summary.applied++;
      if (summary.applied % 100 === 0) {
        console.log(`applied ${summary.applied}/${plans.length}`);
      }
    } catch (error) {
      summary.errors++;
      console.error(`${plan.vendor} ${plan.payload.project.project_id}: ${error.message}`);
    }
  }

  console.log(`APPLIED success=${summary.applied} errors=${summary.errors}`);
  if (summary.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
