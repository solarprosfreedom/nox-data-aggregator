create table if not exists hubspot_sync_state (
  sync_key text primary key,
  last_modified_at timestamptz,
  last_run_at timestamptz not null default now(),
  last_status text not null default 'success' check (last_status in ('success', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hubspot_sync_state_last_run_at_idx
  on hubspot_sync_state (last_run_at desc);

create or replace function set_hubspot_sync_state_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists hubspot_sync_state_updated_at on hubspot_sync_state;
create trigger hubspot_sync_state_updated_at
  before update on hubspot_sync_state
  for each row execute function set_hubspot_sync_state_updated_at();

alter table hubspot_sync_state enable row level security;

drop policy if exists "hubspot_sync_state_select_authenticated" on hubspot_sync_state;
create policy "hubspot_sync_state_select_authenticated" on hubspot_sync_state
  for select to authenticated using (true);
