-- Saved CSV column mappings per installer for the field mapper UI.

create table if not exists mapping_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  installer_name text,
  schema_type text not null check (schema_type in ('projects', 'remittance')),
  column_map jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mapping_templates_schema_installer_idx
  on mapping_templates (schema_type, installer_name);

create index if not exists mapping_templates_created_at_idx
  on mapping_templates (created_at desc);

alter table mapping_templates enable row level security;

drop policy if exists "mapping_templates_select_authenticated" on mapping_templates;
create policy "mapping_templates_select_authenticated" on mapping_templates
  for select to authenticated using (true);

drop policy if exists "mapping_templates_insert_authenticated" on mapping_templates;
create policy "mapping_templates_insert_authenticated" on mapping_templates
  for insert to authenticated with check (true);

drop policy if exists "mapping_templates_update_authenticated" on mapping_templates;
create policy "mapping_templates_update_authenticated" on mapping_templates
  for update to authenticated using (true);

drop policy if exists "mapping_templates_delete_authenticated" on mapping_templates;
create policy "mapping_templates_delete_authenticated" on mapping_templates
  for delete to authenticated using (true);
