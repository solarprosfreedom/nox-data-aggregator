import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { config, DATA_DIR, AUTH_STATE_PATH } from './config.js';

/**
 * Pulls every Lead record from the portal's list-view Apex controller
 * (discovered via network capture) instead of clicking through 137 UI pages.
 *
 * Salesforce enforces a hard platform limit: no query (SOQL OFFSET, or this
 * controller's offsetSize) can page past 2000 rows. To get everything, we
 * recursively partition the dataset — first by Lead Status, then (if a
 * status bucket is still >2000) by successive digits of the HES_ID__c
 * search term — until every bucket is small enough to page through safely.
 * Each partition's coverage is verified (children must sum to the parent's
 * total) so nothing is silently dropped.
 */
const CLASSNAME = '@udd/01pHr00000D2XRk';
const METHOD = 'getLead';
const QUERY_FIELDS = ['Name', 'FirstName', 'LastName', 'HES_ID__c', 'Address', 'Email', 'MobilePhone', 'Status'];
const SAFE_MAX = 1900; // stay comfortably under Salesforce's 2000-row offset ceiling
const PAGE_SIZE = 200;
const STATUSES = ['New_Lead', 'Engaged', 'Lead_Lost', 'Converted_to_Opportunity'];

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
    if (attempt === tries) throw new Error(`Request failed after ${tries} tries: ${res.status()} ${url}`);
  }
}

async function fetchTotal(context, status, searchTerm) {
  const statusList = status ? [status] : [];
  const json = await fetchJson(context, buildUrl(statusList, searchTerm, 0, 1));
  return json.returnValue?.totalRecords ?? 0;
}

async function fetchAllForBucket(context, status, searchTerm, total, sink) {
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const json = await fetchJson(context, buildUrl([status], searchTerm, offset, PAGE_SIZE));
    const list = json.returnValue?.leadList || [];
    for (const l of list) sink.set(l.Id, l);
  }
}

async function partitionAndFetch(context, status, prefix, total, sink, depth = 0) {
  const indent = '  '.repeat(depth + 1);
  if (total <= SAFE_MAX) {
    log(`${indent}fetching bucket search="${prefix || '(none)'}" total=${total}`);
    await fetchAllForBucket(context, status, prefix, total, sink);
    return total;
  }

  log(`${indent}bucket search="${prefix || '(none)'}" total=${total} exceeds ${SAFE_MAX}; splitting further…`);
  const basePrefix = prefix || 'HES-1'; // every HES ID observed so far starts with "HES-1"
  let coveredSum = 0;
  for (let d = 0; d <= 9; d++) {
    const childPrefix = `${basePrefix}${d}`;
    const childTotal = await fetchTotal(context, status, childPrefix);
    if (childTotal > 0) {
      coveredSum += await partitionAndFetch(context, status, childPrefix, childTotal, sink, depth + 1);
    }
  }
  if (coveredSum !== total) {
    log(
      `${indent}WARNING: search="${prefix}" children summed to ${coveredSum}, expected ${total}. ` +
        `${total - coveredSum} record(s) may be missing from this bucket.`
    );
  }
  return coveredSum;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
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

  const grandTotal = await fetchTotal(context, '', '').catch(async () => {
    // Some deployments may reject an empty statusList; fall back to summing statuses.
    return null;
  });

  const sink = new Map(); // Id -> record
  let statusSum = 0;
  for (const status of STATUSES) {
    const total = await fetchTotal(context, status, '');
    log(`Status "${status}": ${total} records`);
    if (total === 0) continue;
    statusSum += await partitionAndFetch(context, status, '', total, sink);
  }

  const expectedTotal = grandTotal ?? statusSum;
  log(`Collected ${sink.size} unique leads (status totals summed to ${statusSum}; portal reports ${expectedTotal} overall).`);
  if (sink.size !== expectedTotal) {
    log(`WARNING: collected count (${sink.size}) does not match portal total (${expectedTotal}). Investigate before trusting this export as complete.`);
  }

  const all = [...sink.values()];
  fs.writeFileSync(path.join(DATA_DIR, 'leads.json'), JSON.stringify(all, null, 2));
  log(`Saved ${all.length} leads -> data/leads.json`);

  const cols = [
    'Id', 'Name', 'FirstName', 'LastName', 'HES_ID__c',
    'Street', 'City', 'State', 'PostalCode', 'Country',
    'Email', 'MobilePhone', 'Status',
  ];
  const rows = all.map((l) =>
    [
      l.Id, l.Name, l.FirstName, l.LastName, l.HES_ID__c,
      l.Address?.street, l.Address?.city, l.Address?.state, l.Address?.postalCode, l.Address?.country,
      l.Email, l.MobilePhone, l.Status,
    ]
      .map(csvEscape)
      .join(',')
  );
  fs.writeFileSync(path.join(DATA_DIR, 'leads.csv'), [cols.join(','), ...rows].join('\n'));
  log(`Saved CSV -> data/leads.csv`);

  await browser.close();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
