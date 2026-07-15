import chromium from "@sparticuz/chromium";
import { chromium as playwright, type BrowserContext, type Page } from "playwright-core";
import {
  listPublicDeals,
  patchPublicDeal,
  publicDealProjectId,
  putPublicDeal,
  type PublicDealRow,
} from "@/lib/public-deals/client";
import {
  normalizeAddress,
  normalizeEmail,
  normalizePhone,
} from "@/lib/terros/matcher";

const DEFAULT_QCELLS_PORTAL_BASE_URL = "https://agility-nosoftware-2332.my.site.com/qcellspartner";
const QCELL_CLASSNAME = "@udd/01pHr00000D2XjW";
const QCELL_METHOD = "getOpportunity";
const QCELL_PAGE_SIZE = 200;

const QCELL_FIELDS = [
  "Id",
  "HES_ID__c",
  "Name",
  "First_Name__c",
  "Last_Name__c",
  "Email_Address__c",
  "Primary_Phone_Number__c",
  "Street_Address__c",
  "City__c",
  "State__c",
  "Zip_Code__c",
  "StageName",
  "Contract_Signed_Date__c",
  "Contract_Signed__c",
  "Total_System_Cost__c",
  "Utility_Company__c",
  "Finance_Type__c",
  "Financier__c",
  "Financing_Company__c",
  "Cash_Price__c",
  "Total_Quoted_Cost_Cash__c",
  "Total_Adders_Cost__c",
  "Total_Battery_Cost__c",
  "List_of_Adders__c",
  "Lead_Channel__c",
  "Lead_Source__c",
  "Sales_Org__c",
] as const;

type JsonRecord = Record<string, unknown>;
type DuplicateReason = "name" | "email" | "phone" | "address";

export type QcellsOpportunity = JsonRecord & {
  Id?: string;
  HES_ID__c?: string;
  Name?: string;
  First_Name__c?: string;
  Last_Name__c?: string;
  Email_Address__c?: string;
  Primary_Phone_Number__c?: string;
  Street_Address__c?: string;
  City__c?: string;
  State__c?: string;
  Zip_Code__c?: string;
  StageName?: string;
  Contract_Signed_Date__c?: string;
  Total_System_Cost__c?: number | string;
  Utility_Company__c?: string;
  Finance_Type__c?: string;
  Financier__c?: string;
  Financing_Company__c?: string;
  Cash_Price__c?: number | string;
  Total_Quoted_Cost_Cash__c?: number | string;
  Total_Adders_Cost__c?: number | string;
  Total_Battery_Cost__c?: number | string;
  List_of_Adders__c?: string;
  Lead_Channel__c?: string;
  Lead_Source__c?: string;
  Sales_Org__c?: string;
};

export type QcellsMappedDeal = {
  project: JsonRecord;
  remittance: JsonRecord;
  rawRow: JsonRecord;
};

export type QcellsClosedWonSyncResult = {
  dryRun: boolean;
  fetched: number;
  liveAxiaRows: number;
  inserted: number;
  updated: number;
  unchanged: number;
  duplicateSkipped: number;
  duplicateReasons: Record<DuplicateReason, number>;
  errors: Array<{ projectId: string; message: string }>;
};

function qcellsPortalBaseUrl() {
  return (process.env.QCELLS_PORTAL_BASE_URL?.trim() || DEFAULT_QCELLS_PORTAL_BASE_URL).replace(/\/$/, "");
}

function requiredQcellsCredentials() {
  const username = process.env.QCELLS_PORTAL_USERNAME?.trim();
  const password = process.env.QCELLS_PORTAL_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("Missing QCELLS_PORTAL_USERNAME or QCELLS_PORTAL_PASSWORD");
  }
  return { username, password };
}

function stringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = stringValue(value);
  if (!text) return undefined;
  const number = Number(text.replace(/[$,]/g, ""));
  return Number.isFinite(number) ? number : undefined;
}

function dateOnly(value: unknown): string | undefined {
  const source = stringValue(value);
  if (!source) return undefined;
  const direct = source.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function compactNonEmpty(value: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function identityName(row: PublicDealRow): string {
  const project = row.project ?? {};
  const firstLast = [project.first_name, project.last_name]
    .map(stringValue)
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return normalizeName(firstLast || project.opportunity_name);
}

function qcellsName(row: QcellsOpportunity): string {
  return normalizeName(
    [stringValue(row.First_Name__c), stringValue(row.Last_Name__c)]
      .filter((value): value is string => Boolean(value))
      .join(" ") || row.Name,
  );
}

function valueEquals(left: unknown, right: unknown): boolean {
  if (left == null || left === "") return right == null || right === "";
  if (right == null || right === "") return false;

  if (typeof left === "number" || typeof right === "number") {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
  }

  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function hasChanged(current: JsonRecord, candidate: JsonRecord) {
  return Object.entries(candidate).some(([key, value]) => !valueEquals(current[key], value));
}

function qcellsRawRow(row: QcellsOpportunity): JsonRecord {
  return compactNonEmpty({
    source: "qcells_closed_won",
    qcells_opportunity_id: row.Id,
    hes_id: row.HES_ID__c,
    opportunity_name: row.Name,
    first_name: row.First_Name__c,
    last_name: row.Last_Name__c,
    email: row.Email_Address__c,
    phone: row.Primary_Phone_Number__c,
    street_address: row.Street_Address__c,
    city: row.City__c,
    state: row.State__c,
    postal_code: row.Zip_Code__c,
    stage: row.StageName,
    contract_signed_date: row.Contract_Signed_Date__c,
    total_system_cost: row.Total_System_Cost__c,
    utility_company: row.Utility_Company__c,
    finance_type: row.Finance_Type__c,
    financier: row.Financier__c,
    financing_company: row.Financing_Company__c,
    cash_price: row.Cash_Price__c,
    total_quoted_cost_cash: row.Total_Quoted_Cost_Cash__c,
    total_adders_cost: row.Total_Adders_Cost__c,
    total_battery_cost: row.Total_Battery_Cost__c,
    list_of_adders: row.List_of_Adders__c,
    lead_channel: row.Lead_Channel__c,
    lead_source: row.Lead_Source__c,
    sales_org: row.Sales_Org__c,
  });
}

/** Maps only confirmed Qcells fields. Sales advisor remains excluded because Qcells provides a Salesforce user ID, not a person. */
export function mapQcellsOpportunity(row: QcellsOpportunity): QcellsMappedDeal {
  const contractDate = dateOnly(row.Contract_Signed_Date__c);
  const totalSystemCost = numberValue(row.Total_System_Cost__c);
  const utility = stringValue(row.Utility_Company__c);

  return {
    project: compactNonEmpty({
      project_id: stringValue(row.HES_ID__c),
      opportunity_name: stringValue(row.Name),
      first_name: stringValue(row.First_Name__c),
      last_name: stringValue(row.Last_Name__c),
      email: stringValue(row.Email_Address__c),
      phone: stringValue(row.Primary_Phone_Number__c),
      address_line1: stringValue(row.Street_Address__c),
      city: stringValue(row.City__c),
      state_code: stringValue(row.State__c),
      postal_code: stringValue(row.Zip_Code__c),
      project_stage: stringValue(row.StageName),
      contract_signed_date: contractDate,
      total_system_cost: totalSystemCost,
      utility_provider: utility,
    }),
    remittance: compactNonEmpty({
      sales_partner: stringValue(row.Sales_Org__c),
      channel: stringValue(row.Lead_Channel__c) ?? stringValue(row.Lead_Source__c),
      finance_type: stringValue(row.Finance_Type__c),
      financier: stringValue(row.Financier__c) ?? stringValue(row.Financing_Company__c),
      utility_provider: utility,
      contract_adder_detail: stringValue(row.List_of_Adders__c),
      contract_amount: totalSystemCost,
      cash_deal_value: numberValue(row.Cash_Price__c) ?? numberValue(row.Total_Quoted_Cost_Cash__c),
      battery_price: numberValue(row.Total_Battery_Cost__c),
      adder_amount: numberValue(row.Total_Adders_Cost__c),
      contract_date: contractDate,
    }),
    rawRow: qcellsRawRow(row),
  };
}

/** Returns every conservative identity collision. Any collision prevents an insert. */
export function duplicateReasonsForQcells(
  source: QcellsOpportunity,
  existingRows: PublicDealRow[],
): DuplicateReason[] {
  const sourceNames = new Set([qcellsName(source), normalizeName(source.Name)].filter(Boolean));
  const sourceEmail = normalizeEmail(stringValue(source.Email_Address__c));
  const sourcePhone = normalizePhone(stringValue(source.Primary_Phone_Number__c));
  const sourceAddress = normalizeAddress(stringValue(source.Street_Address__c));
  const reasons = new Set<DuplicateReason>();

  for (const row of existingRows) {
    const project = row.project ?? {};
    const rowNames = [identityName(row), normalizeName(project.opportunity_name)].filter(Boolean);
    if (rowNames.some((name) => sourceNames.has(name))) reasons.add("name");
    if (sourceEmail && sourceEmail === normalizeEmail(stringValue(project.email))) reasons.add("email");
    if (sourcePhone.length >= 10 && sourcePhone === normalizePhone(stringValue(project.phone))) reasons.add("phone");
    if (
      sourceAddress &&
      sourceAddress === normalizeAddress(stringValue(project.address_line1))
    ) {
      reasons.add("address");
    }
  }

  return [...reasons];
}

/** Preserves every existing non-empty Axia field, then overlays only non-empty Qcells fields. */
export function buildQcellsUpdate(
  existing: PublicDealRow,
  mapped: QcellsMappedDeal,
): { project: JsonRecord; remittance: JsonRecord } | null {
  const currentProject = existing.project ?? {};
  const currentRemittance = existing.remittance ?? {};
  if (!hasChanged(currentProject, mapped.project) && !hasChanged(currentRemittance, mapped.remittance)) {
    return null;
  }

  return {
    project: compactNonEmpty({ ...currentProject, ...mapped.project }),
    remittance: compactNonEmpty({ ...currentRemittance, ...mapped.remittance }),
  };
}

function opportunityUrl(offset: number) {
  const params = new URLSearchParams({
    cacheable: "true",
    classname: QCELL_CLASSNAME,
    isContinuation: "false",
    method: QCELL_METHOD,
    namespace: "",
    params: JSON.stringify({
      filterConditions: {
        statusList: ["Closed Won"],
        limitSize: QCELL_PAGE_SIZE,
        offsetSize: offset,
        searchTerm: "",
        queryFields: QCELL_FIELDS,
      },
    }),
    language: "en-US",
    asGuest: "false",
    htmlEncode: "false",
  });
  return `${qcellsPortalBaseUrl()}/webruntime/api/apex/execute?${params}`;
}

async function fetchQcellsClosedWon(context: BrowserContext): Promise<QcellsOpportunity[]> {
  const rows: QcellsOpportunity[] = [];
  let expectedTotal: number | undefined;

  for (let offset = 0; ; ) {
    const response = await context.request.get(opportunityUrl(offset));
    if (!response.ok()) throw new Error(`Qcells Opportunity request failed (${response.status()})`);
    const body = (await response.json()) as {
      returnValue?: { totalRecords?: number; opportunityList?: QcellsOpportunity[] };
    };
    const page = body.returnValue?.opportunityList ?? [];
    expectedTotal ??= body.returnValue?.totalRecords;
    rows.push(...page);
    if (page.length === 0 || (expectedTotal !== undefined && rows.length >= expectedTotal)) return rows;
    offset += page.length;
  }
}

async function firstVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "visible", timeout: 2_000 });
      return locator;
    } catch {
      // Keep trying the login variants used by Salesforce Experience Cloud.
    }
  }
  throw new Error("Could not find a Qcells portal login control");
}

async function openQcellsContext() {
  const { username, password } = requiredQcellsCredentials();
  const localExecutable = process.env.QCELLS_CHROMIUM_EXECUTABLE_PATH?.trim();
  const browser = await playwright.launch({
    headless: true,
    args: localExecutable ? [] : chromium.args,
    executablePath: localExecutable || (await chromium.executablePath()),
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(`${qcellsPortalBaseUrl()}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  if (page.url().includes("/login") || (await page.locator("input[type=password]").count()) > 0) {
    await (await firstVisible(page, [
      "input[name=emailField]", "#username", "input[name=username]", "input[autocomplete=username]", "input[type=email]",
    ])).fill(username);
    await (await firstVisible(page, [
      "input[name=currentPasswordField]", "#password", "input[name=password]", "input[type=password]",
    ])).fill(password);
    await (await firstVisible(page, [
      "#loginButton", "button[type=submit]", "input[type=submit]", "button:has-text(\"Sign In\")", "button:has-text(\"Log In\")",
    ])).click();
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  }
  if (page.url().includes("/login")) {
    await browser.close();
    throw new Error("Qcells portal login did not complete");
  }
  return { browser, context };
}

/**
 * Fresh-logs into Qcells, reads Closed Won opportunities, and synchronizes only confirmed fields.
 * The function never sends blank/null source values and never creates a record with a secondary identity collision.
 */
export async function runQcellsClosedWonSync(options: { dryRun: boolean }): Promise<QcellsClosedWonSyncResult> {
  const { browser, context } = await openQcellsContext();
  try {
    const [sourceRows, liveRows] = await Promise.all([
      fetchQcellsClosedWon(context),
      listPublicDeals("axia"),
    ]);
    const result: QcellsClosedWonSyncResult = {
      dryRun: options.dryRun,
      fetched: sourceRows.length,
      liveAxiaRows: liveRows.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      duplicateSkipped: 0,
      duplicateReasons: { name: 0, email: 0, phone: 0, address: 0 },
      errors: [],
    };
    const byProjectId = new Map(liveRows.map((row) => [publicDealProjectId(row), row]));
    const planned: Array<
      | { action: "insert"; source: QcellsOpportunity; mapped: QcellsMappedDeal }
      | { action: "update"; projectId: string; update: { project: JsonRecord; remittance: JsonRecord } }
    > = [];

    for (const source of sourceRows) {
      const projectId = stringValue(source.HES_ID__c);
      if (!projectId) {
        result.errors.push({ projectId: stringValue(source.Id) ?? "unknown", message: "Missing HES ID" });
        continue;
      }
      const mapped = mapQcellsOpportunity(source);
      const existing = byProjectId.get(projectId);
      if (existing) {
        const update = buildQcellsUpdate(existing, mapped);
        if (!update) {
          result.unchanged += 1;
          continue;
        }
        planned.push({ action: "update", projectId, update });
        continue;
      }

      const reasons = duplicateReasonsForQcells(source, liveRows);
      if (reasons.length > 0) {
        result.duplicateSkipped += 1;
        for (const reason of reasons) result.duplicateReasons[reason] += 1;
        continue;
      }
      planned.push({ action: "insert", source, mapped });
    }

    if (options.dryRun) {
      result.inserted = planned.filter((item) => item.action === "insert").length;
      result.updated = planned.filter((item) => item.action === "update").length;
      return result;
    }

    for (const item of planned) {
      try {
        if (item.action === "update") {
          await patchPublicDeal("axia", item.projectId, item.update);
          result.updated += 1;
          continue;
        }

        // A second read immediately before INSERT protects against a retry or overlapping invocation.
        const latestRows = await listPublicDeals("axia");
        const projectId = stringValue(item.source.HES_ID__c)!;
        if (
          latestRows.some((row) => publicDealProjectId(row) === projectId) ||
          duplicateReasonsForQcells(item.source, latestRows).length > 0
        ) {
          result.duplicateSkipped += 1;
          continue;
        }
        await putPublicDeal("axia", {
          project: item.mapped.project,
          remittance: item.mapped.remittance,
          source: { file_name: "Qcells Closed Won portal sync", raw_row: item.mapped.rawRow },
        });
        result.inserted += 1;
      } catch (error) {
        result.errors.push({
          projectId: item.action === "update" ? item.projectId : stringValue(item.source.HES_ID__c) ?? "unknown",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  } finally {
    await browser.close();
  }
}
