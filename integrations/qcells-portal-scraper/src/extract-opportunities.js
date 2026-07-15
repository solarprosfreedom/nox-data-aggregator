import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { config, DATA_DIR, AUTH_STATE_PATH } from './config.js';

/**
 * Pulls every Opportunity ("deal") record from the portal's list-view Apex
 * controller, requesting every field the controller will accept (discovered
 * via trial-and-error against the full object-info field list — only
 * `CloneSourceId` is rejected).
 *
 * Same 2000-row offset ceiling applies here as with Leads (see
 * extract-leads.js), so this reuses the same status/prefix partitioning
 * safety net even though the current dataset (~576 records) doesn't need it.
 */
const CLASSNAME = '@udd/01pHr00000D2XjW';
const METHOD = 'getOpportunity';
const SAFE_MAX = 1900;
const PAGE_SIZE = 200;
const STAGES = [
  'Consultation Scheduled',
  'Consultation Disposition',
  'Disqualified',
  'Proposal Sent',
  'Contract Sent',
  'Closed Won',
  'Closed Lost',
];

// Full Opportunity field set from object-info, minus fields the controller
// rejects with "No such column ... on entity 'Opportunity'".
const ALL_FIELDS = [
  'AccountId', 'AgeInDays', 'Amount', 'Appointment_Date_Time__c', 'Appointment_Date__c', 'Bad_Email__c',
  'Bad_Number__c', 'Battery_Size_Quoted__c', 'Battery_Size__c', 'Battery__c', 'Billing_Street2__c',
  'Budget_Confirmed__c', 'Calendly__c', 'Campaign__c', 'Cash_Price__c', 'Change_Order_Contract__c', 'City__c',
  'CloneSourceId', 'CloseDate', 'Consultation_Date_Time__c', 'ContactId', 'ContractId', 'Contract_Sent__c',
  'Contract_Signed_Date__c', 'Contract_Signed__c', 'Converted_Lead_Id__c', 'Converted_Lead__c', 'Country__c',
  'CreatedById', 'CreatedDate', 'Creatio_HES_ID__c', 'Creatio_ID__c', 'Credit__c', 'Date_of_Utility_Bill__c',
  'Description', 'Discovery_Completed__c', 'Does_the_customer_have_an_HOA__c', 'Does_this_sale_include_a_battery__c',
  'Email_Address__c', 'Energy_Consultant_Assigned__c', 'Energy_Consultant__c', 'Energy_Offset__c',
  'Estimated_Project_Start_Date__c', 'ExpectedRevenue', 'Finance_Type__c', 'Financier__c', 'Financing_Company__c',
  'First_Name__c', 'Fiscal', 'FiscalQuarter', 'FiscalYear', 'ForecastCategory', 'ForecastCategoryName',
  'Future_Consultation_Scheduled__c', 'HES_ID__c', 'HasOpenActivity', 'HasOpportunityLineItem', 'HasOverdueTask',
  'Has_Appointment__c', 'Homeowner__c', 'Id', 'Inverter_List__c', 'Inverter__c', 'IsClosed', 'IsDeleted',
  'IsPriorityRecord', 'IsPrivate', 'IsWon', 'Is_Migrated__c', 'Is_Sales_Handsoff_Form_Completed__c',
  'Is_the_home_in_a_trust__c', 'LastActivityDate', 'LastActivityInDays', 'LastAmountChangedHistoryId',
  'LastCloseDateChangedHistoryId', 'LastModifiedById', 'LastModifiedDate', 'LastReferencedDate',
  'LastStageChangeDate', 'LastStageChangeInDays', 'LastViewedDate', 'Last_Name__c',
  'Latest_Contract_Signed_Date__c', 'LeadSource', 'Lead_Channel__c', 'Lead_Source__c', 'Lead_Type__c',
  'List_of_Adders__c', 'Loss_Reason__c', 'Micro_Inverter__c', 'Migrated_Date_Time__c', 'Migrated_Notes__c',
  'Monthly_Electric_Bill__c', 'Monthly_Payment__c', 'Monthly_kWh_Usage__c', 'Name',
  'New_Construction_Resource_Setting_Id__c', 'New_Construction__c', 'New_Home_Build__c', 'NextStep',
  'Number_Of_Micro_Inverters__c', 'Number_of_Batteries__c', 'Number_of_Inverters__c', 'Number_of_Panels__c',
  'Number_of_Storage_Inverters__c', 'Number_of_String_Inverters__c', 'Opportunity_Token__c', 'OwnerId',
  'Owner_Reports_To__c', 'Panels__c', 'PartnerAccountId', 'Previous_Lead_Owner__c', 'Primary_Phone_Number__c',
  'Primary_Phone_Type__c', 'Primary_Proposal_Link__c', 'Probability', 'Products_Selected__c', 'Products__c',
  'Project_Class__c', 'Project_Coordinator__c', 'Proposal_Sent__c', 'PushCount', 'Quoted_Cost_per_Watt__c',
  'Quoted_System_Size__c', 'ROI_Analysis_Completed__c', 'RecordTypeId', 'Referred__c', 'Roof_Age__c',
  'Roof_Type_Other__c', 'Roof_Type__c', 'Sales_Advisor__c', 'Sales_Handsoff_Form_Completed_On__c', 'Sales_Org__c',
  'Sellable__c', 'Send_Sales_Handoff_Form_Email_Date_Time__c', 'Shading__c', 'Site_Survey_Date_And_Time__c',
  'Solar_Advisor_Assigned__c', 'Solar_Advisor__c', 'StageName', 'State__c', 'State_and_Local_Rebate_Details__c',
  'State_and_Local_Rebates__c', 'Storage_Inverter__c', 'Storage_Size__c', 'Street_Address__c',
  'String_Inverter__c', 'Substage_Reason__c', 'Substage__c', 'SyncedQuoteId', 'SystemModstamp',
  'System_Size_KWH__c', 'TimeZone__c', 'TotalOpportunityQuantity', 'Total_Adders_Cost__c', 'Total_Battery_Cost__c',
  'Total_Number_of_Inverters__c', 'Total_Quoted_Cost_Cash__c', 'Total_Quoted_Cost_Financing__c',
  'Total_System_Cost__c', 'Total_System_Cost_incl_financing__c', 'True_Up_Design__c', 'Type', 'UTM_Content__c',
  'UTM_Medium__c', 'UTM_Source__c', 'UTM_Target__c', 'UTM_Term__c', 'Unsynched_Project_found__c',
  'Utility_Company__c', 'Viewed_Solar_Calculator__c', 'Was_a_site_survey_scheduled__c', 'Web_Proposal_Url__c',
  'Zip_Code__c', 'kWh_Rate__c',
];
const REJECTED_FIELDS = new Set(['CloneSourceId']);
const QUERY_FIELDS = ALL_FIELDS.filter((f) => !REJECTED_FIELDS.has(f));

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function buildUrl(statusList, searchTerm, offset, limit) {
  const params = {
    filterConditions: { statusList, limitSize: limit, offsetSize: offset, searchTerm, queryFields: QUERY_FIELDS },
  };
  const qs = new URLSearchParams({
    cacheable: 'true',
    classname: CLASSNAME,
    isContinuation: 'false',
    method: METHOD,
    namespace: '',
    params: JSON.stringify(params),
    language: 'en-US',
    asGuest: 'false',
    htmlEncode: 'false',
  });
  return `${config.baseUrl}/webruntime/api/apex/execute?${qs.toString()}`;
}

async function fetchJson(context, url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await context.request.get(url);
    if (res.ok()) return res.json();
    if (attempt === tries) throw new Error(`Request failed after ${tries} tries: ${res.status()} ${url} :: ${await res.text()}`);
  }
}

async function fetchTotal(context, stage, searchTerm) {
  const statusList = stage ? [stage] : [];
  const json = await fetchJson(context, buildUrl(statusList, searchTerm, 0, 1));
  return json.returnValue?.totalRecords ?? 0;
}

async function fetchAllForBucket(context, stage, searchTerm, total, sink, rawPages) {
  // NOTE: when requesting ~174 fields, the platform silently truncates each
  // response to well under the requested `limitSize` (observed ~62 rows for
  // a request of 200), almost certainly a response-size/heap limit. We must
  // advance the offset by the number of records *actually returned*, not by
  // PAGE_SIZE, or we'd silently skip records sitting between the truncated
  // count and the requested page size.
  let offset = 0;
  let guard = 0;
  while (offset < total) {
    const json = await fetchJson(context, buildUrl([stage], searchTerm, offset, PAGE_SIZE));
    rawPages.push({ stage, searchTerm, offset, limit: PAGE_SIZE, response: json });
    const list = json.returnValue?.opportunityList || [];
    for (const o of list) sink.set(o.Id, o);
    if (list.length === 0) {
      log(`    ! no records returned at offset ${offset} (bucket total=${total}); stopping this bucket early.`);
      break;
    }
    if (list.length < PAGE_SIZE) {
      log(`    (server returned ${list.length}/${PAGE_SIZE} requested at offset ${offset} — advancing by actual count)`);
    }
    offset += list.length;
    if (++guard > 1000) {
      log('    ! guard limit hit (1000 requests), aborting bucket to avoid an infinite loop');
      break;
    }
  }
}

async function partitionAndFetch(context, stage, prefix, total, sink, rawPages, depth = 0) {
  const indent = '  '.repeat(depth + 1);
  if (total <= SAFE_MAX) {
    log(`${indent}fetching bucket search="${prefix || '(none)'}" total=${total}`);
    await fetchAllForBucket(context, stage, prefix, total, sink, rawPages);
    return total;
  }

  log(`${indent}bucket search="${prefix || '(none)'}" total=${total} exceeds ${SAFE_MAX}; splitting further…`);
  const basePrefix = prefix || 'HES-1';
  let coveredSum = 0;
  for (let d = 0; d <= 9; d++) {
    const childPrefix = `${basePrefix}${d}`;
    const childTotal = await fetchTotal(context, stage, childPrefix);
    if (childTotal > 0) {
      coveredSum += await partitionAndFetch(context, stage, childPrefix, childTotal, sink, rawPages, depth + 1);
    }
  }
  if (coveredSum !== total) {
    log(`${indent}WARNING: search="${prefix}" children summed to ${coveredSum}, expected ${total}.`);
  }
  return coveredSum;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return csvEscape(JSON.stringify(v));
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error('No saved session. Run `npm run login` first to authenticate.');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });

  const grandTotal = await fetchTotal(context, null, '');
  log(`Portal reports ${grandTotal} total Opportunities. Requesting ${QUERY_FIELDS.length} fields per record.`);

  const sink = new Map();
  const rawPages = [];
  let stageSum = 0;
  for (const stage of STAGES) {
    const total = await fetchTotal(context, stage, '');
    log(`Stage "${stage}": ${total} records`);
    if (total === 0) continue;
    stageSum += await partitionAndFetch(context, stage, '', total, sink, rawPages);
  }

  log(`Collected ${sink.size} unique opportunities (stage totals summed to ${stageSum}; portal reports ${grandTotal} overall).`);
  if (sink.size !== grandTotal) {
    log(`WARNING: collected count (${sink.size}) does not match portal total (${grandTotal}). Investigate before trusting this export as complete.`);
  }

  // Raw payload: every API response exactly as returned, for full fidelity / audit.
  fs.writeFileSync(path.join(DATA_DIR, 'opportunities-raw-responses.json'), JSON.stringify(rawPages, null, 2));
  log(`Saved ${rawPages.length} raw API page responses -> data/opportunities-raw-responses.json`);

  const all = [...sink.values()];
  fs.writeFileSync(path.join(DATA_DIR, 'opportunities.json'), JSON.stringify(all, null, 2));
  log(`Saved ${all.length} deduped opportunities -> data/opportunities.json`);

  const cols = QUERY_FIELDS; // Id, StageName, Amount, etc. — every field we requested
  const rows = all.map((o) => cols.map((c) => csvEscape(o[c])).join(','));
  fs.writeFileSync(path.join(DATA_DIR, 'opportunities.csv'), [cols.join(','), ...rows].join('\n'));
  log(`Saved CSV (${cols.length} columns) -> data/opportunities.csv`);

  await browser.close();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
