-- Sequifi two-way sync: read-back columns for Sequifi-owned data.
-- Supabase stays the source of truth for shared fields; these columns hold
-- values that only exist in Sequifi so the app data is never overwritten.

alter table projects add column if not exists sequifi_job_status text;
alter table projects add column if not exists sequifi_net_epc numeric;
alter table projects add column if not exists sequifi_total_commission numeric;
alter table projects add column if not exists sequifi_synced_at timestamptz;

create index if not exists projects_sequifi_sale_id_idx on projects (sequifi_sale_id);
