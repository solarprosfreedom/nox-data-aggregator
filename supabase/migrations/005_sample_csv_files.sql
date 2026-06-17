-- Reference sample CSV files for column mapping and testing (not production imports).

create table if not exists sample_csv_files (
  id uuid primary key default gen_random_uuid(),

  label text not null,
  source_type text not null check (
    source_type in ('projects_sheet', 'terros_export', 'remittance')
  ),
  installer text,

  file_name text not null,
  file_content text not null,
  row_count int not null default 0,
  column_headers jsonb,

  notes text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sample_csv_files_source_type_idx
  on sample_csv_files (source_type);

create index if not exists sample_csv_files_created_at_idx
  on sample_csv_files (created_at desc);

alter table sample_csv_files enable row level security;

drop policy if exists "sample_csv_files_select_authenticated" on sample_csv_files;
create policy "sample_csv_files_select_authenticated" on sample_csv_files
  for select to authenticated using (true);
