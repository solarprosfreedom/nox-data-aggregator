# Qcells Partner Portal Scraper

Authenticated data extraction for the **Qcells Partner Portal**
(`https://agility-nosoftware-2332.my.site.com/qcellspartner`), which is a
Salesforce **Experience Cloud (LWR)** site. There is no public API or download
button, so we drive it with a real browser (Playwright), log in, and call the
same background data endpoints the page itself uses.

## Why a browser?

The portal serves an empty JavaScript shell and loads all data over background
API calls (Salesforce Apex / UI API) using your authenticated session. Plain
HTTP tools (`curl`, `requests`) only get the empty shell. Playwright logs in
once, saves the session, and lets us replay the exact data endpoints directly
(much faster than clicking through paginated UI tables).

## Setup

```bash
npm install
npx playwright install chromium   # if the browser binary isn't cached yet
```

Fill in your credentials in `.env` (copy `.env.example` if starting fresh):

```
PORTAL_USERNAME=you@example.com
PORTAL_PASSWORD=••••••••
HEADED=1        # watch the browser (only useful if a real display is attached)
```

## Usage

**1. Log in and save a session:**

```bash
npm run login
```

Saves cookies/session to `auth-state.json` (gitignored) and a screenshot to
`data/post-login.png` so you can confirm it worked.

**2. Extract all Leads:**

```bash
npm run extract:leads
```

Writes `data/leads.json` and `data/leads.csv` with every Lead record. On the
last run this pulled all **3,411** leads and self-verified the count matches
the portal's own total.

## How the Leads extractor works

The Leads list view (`/lead/Lead/Default`) is powered by a custom Apex
controller reachable at:

```
GET /qcellspartner/webruntime/api/apex/execute
    ?classname=@udd/01pHr00000D2XRk&method=getLead
    &params={"filterConditions":{"statusList":[...],"limitSize":N,"offsetSize":N,"searchTerm":"...","queryFields":[...]}}
```

Salesforce enforces a **hard platform limit: no query can page past offset
2000** (this applies to SOQL, the standard UI API, and this custom
controller equally — verified during development). To get every record
anyway, `src/extract-leads.js`:

1. Splits the query by `Status` first (`New_Lead`, `Engaged`, `Lead_Lost`,
   `Converted_to_Opportunity`).
2. If a status bucket is still over ~1900 records, recursively narrows it
   further using `searchTerm` against successive digits of `HES_ID__c`
   (e.g. `HES-111`, then `HES-1111`, `HES-1112`, …) until every bucket is
   small enough to page through safely.
3. Verifies at every level that the child buckets sum to the parent's
   reported total, logging a warning if anything doesn't add up.
4. Dedupes by `Id` and writes CSV + JSON.

This adapts automatically if the dataset grows — it only splits buckets that
actually exceed the safe limit.

**3. Extract all Opportunities ("deals"), every field:**

```bash
npm run extract:opportunities
```

Writes:
- `data/opportunities.json` — 576 deduped records, all 174 usable fields (`CloneSourceId` is the one field the controller rejects out of the full 175-field describe).
- `data/opportunities.csv` — same data flattened to CSV.
- `data/opportunities-raw-responses.json` — every raw API page response exactly as returned (per stage/offset), for full audit/provenance.

Note: Leads and Opportunities ("deals") are different objects. A Lead's
`Status` field only tells you *whether* it converted
(`Converted to Opportunity`) — the actual deal details (`StageName`,
`Amount`, `CloseDate`, `Total_System_Cost__c`, financing, system size, etc.)
live on the Opportunity record produced by that conversion.

**Gotcha discovered while building this:** requesting Opportunities with all
~174 fields causes the platform to silently truncate each page to far fewer
rows than requested (observed ~62 of a requested 200 — almost certainly a
response-size/heap limit, not the 2000-row offset limit). The extractor
handles this by advancing its offset by the *actual* number of records
returned each call, not by the requested page size, so no records get
skipped.

## Extending to other objects (Sites, Contacts, Projects…)

1. Log in (`npm run login`), then capture a page's network calls:
   ```bash
   node src/extract.js /opportunity/Opportunity/Default
   ```
2. Inspect `data/extract-network.json` for a similar
   `webruntime/api/apex/execute?...method=get<Object>...` call — it'll show
   the `classname`, `method`, and `filterConditions` shape.
3. Copy `src/extract-leads.js` as a template, swap in the new
   `classname`/`method`/fields, and re-run the same status/prefix
   partitioning approach if the object also has a filterable status-like
   field and a unique ID pattern. If it doesn't hit 2000 rows, skip the
   partitioning entirely and just page with `offsetSize`.

## Files

| File | Purpose |
|------|---------|
| `src/config.js` | Loads `.env`, paths, credential check |
| `src/login.js`  | Logs in, saves session, `--discover` logs network calls |
| `src/extract.js`| Reuses saved session, opens any page, dumps HTML + API calls (for discovering new endpoints) |
| `src/extract-leads.js` | Full Lead extractor with automatic 2000-row-limit partitioning |
| `auth-state.json` | Saved cookies/session (gitignored) |
| `data/` | Screenshots, HTML, network logs, `leads.json`/`leads.csv` (gitignored) |

## Notes

- Credentials and all output are gitignored.
- If the login form selectors don't match after a portal update, check
  `data/post-login.png` and adjust the selectors in `src/login.js`
  (`input[name="emailField"]` / `input[name="currentPasswordField"]` /
  `button:has-text("Sign In")` as of this writing).
- Only use this against a portal you're authorized to access.
