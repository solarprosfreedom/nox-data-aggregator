create type hub_import_status as enum ('pending', 'processing', 'completed', 'failed', 'partial');

create table if not exists hub_import_log (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('projects_sheet', 'terros_export', 'remittance')),
  file_name text not null,
  file_hash text not null,
  row_count int not null default 0,
  inserted_count int not null default 0,
  updated_count int not null default 0,
  matched_count int not null default 0,
  error_count int not null default 0,
  status hub_import_status not null default 'pending',
  error_summary text,
  uploaded_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, file_hash)
);

create index if not exists hub_import_log_created_at_idx on hub_import_log (created_at desc);

alter table hub_import_log enable row level security;

drop policy if exists "hub_import_log_select_authenticated" on hub_import_log;
create policy "hub_import_log_select_authenticated" on hub_import_log
  for select to authenticated using (true);
