# NOX Data Hub

Import and consolidate **projects**, **Terros exports**, and **remittance** files into a single Supabase database shared with [nox-crm](../enerflo-mvp).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment** — copy `.env.local.example` to `.env.local` and use the **same Supabase project** as nox-crm:

   ```bash
   cp .env.local.example .env.local
   ```

   Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Optional: Azure Graph vars for login emails (same as CRM), `DATA_HUB_API_KEY` for Sequifi API, app URLs for the launcher.

3. **Run migrations** in Supabase SQL editor (in order):

   - `supabase/migrations/001_hub_projects.sql`
   - `supabase/migrations/002_hub_remittance.sql`
   - `supabase/migrations/003_user_app_access.sql`
   - `supabase/migrations/004_hub_import_log.sql`
   - `supabase/migrations/008_hubspot_sync_state.sql` (for HubSpot recurring sync)

   Also run `enerflo-mvp/supabase/migrations/007_user_app_access.sql` if not already applied (same table).

4. **Start the app** (port 3001):

   ```bash
   npm run dev
   ```

   CRM runs on port 3000. After login, use **Choose an app** to switch between CRM and Data Hub.

## Import file types

| Filename hint | Source | Upsert key |
|---------------|--------|------------|
| projects sheet | `projects_sheet` | `HES ID` |
| `*terros*` | `terros_export` | Match project → write setter |
| `*remittance*` | `remittance` | `HES Code` + payment date |

Export Excel files as **CSV** before upload.

## Sequifi API

```http
GET /api/v1/projects?page=1&per_page=50&updated_since=2026-01-01T00:00:00Z
X-API-Key: your-data-hub-api-key
```

Set `DATA_HUB_API_KEY` in `.env.local`.

## HubSpot Illum recurring sync

- Set `HUB_SPOT_ILLUM` to your HubSpot private app token.
- Set `CRON_SECRET` and use the same value in your cron caller.
- Cron endpoint: `POST /api/cron/hubspot-illum-sync`
- Optional full backfill/prune run: `POST /api/cron/hubspot-illum-sync?full_refresh=1`
- Scheduled every 15 minutes via `vercel.json`.

## Tape OWE recurring sync

- OWE data source is Tape (`TAPE_API_KEY` must be set).
- Set `TAPE_OWE_VIEW_ID` to the OWE Tape view id (or it falls back to `TAPE_CUSTOMERS_VIEW_ID`).
- Reuse `CRON_SECRET` for auth.
- Cron endpoint: `POST /api/cron/tape-owe-sync`
- This sync always upserts the full configured Tape view.
- Scheduled every 15 minutes (offset from Illum) via `vercel.json`.

## Tape customers recurring sync

- Set `TAPE_API_KEY` and `TAPE_CUSTOMERS_VIEW_ID`.
- Reuse `CRON_SECRET` for auth.
- Cron endpoint: `POST /api/cron/tape-customers-sync`
- Upserts into `tape_customers` on `tape_record_id`.
- Scheduled every 15 minutes (offset from other cron jobs) via `vercel.json`.

## Coperniq outbound webhooks

- Endpoint: `POST /api/webhooks/coperniq`
- Accepts Coperniq `application/json` webhook payloads and stores the exact raw body plus parsed normalized fields in `coperniq_webhooks`.
- Auth is optional. Leave `COPERNIQ_WEBHOOK_SECRET` blank for Coperniq's no-auth setup, or set it and pass the value as `x-coperniq-webhook-secret`, `x-webhook-secret`, bearer token, `?secret=`, or `?token=`.

## Coperniq → Tron recurring sync

- Set `COPERNIQ_API_KEY` to the Coperniq Projects API key and reuse the existing `PUBLIC_DEALS_API_KEY` plus `CRON_SECRET` values.
- Sync endpoint: `POST /api/cron/coperniq-tron-sync`.
- It paginates all Coperniq projects, inserts missing Tron records, updates mapped source fields, and preserves existing remittance fields that Coperniq does not provide.
- Vercel runs it every 15 minutes at minutes 12, 27, 42, and 57.

## Qcells Closed Won → Axia recurring sync

- Set `QCELLS_PORTAL_USERNAME` and `QCELLS_PORTAL_PASSWORD`; the job creates a fresh Qcells session on every run, so it does not depend on an expiring saved browser session.
- Reuse `PUBLIC_DEALS_API_KEY` and `CRON_SECRET`.
- Cron endpoint: `POST /api/cron/qcells-closed-won-sync`. Add `?dry_run=1` to calculate actions without writing.
- It patches only non-empty, confirmed Qcells fields and preserves all Axia fields Qcells does not provide.
- A new HES ID is created only when there is no Axia collision by normalized name, email, phone, or address. Collisions are skipped instead of creating a duplicate.
- Vercel runs it daily at 02:30 UTC via `vercel.json`.

## Architecture

- **`hub_projects`** — unified project/deal records
- **`hub_remittance`** — per-project payment snapshots
- **`hub_import_log`** — upload audit trail
- **`user_app_access`** — shared with CRM for app launcher
