-- SSOT: one row per deal/opportunity (matches live Supabase `projects` table).

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),

  project_id text not null unique,

  opportunity_name text,
  first_name text,
  last_name text,
  address_line1 text,
  city text,
  state_code text,
  postal_code text,
  email text,
  phone text,

  project_stage text,
  contract_signed_date date,
  total_system_cost numeric,
  system_size_kw numeric,

  sales_advisor_name text,
  sales_advisor_email text,
  setter_name text,
  setter_email text,
  closer_name text,
  closer_email text,

  sales_advisor_sequifi_employee_id text,
  setter_sequifi_employee_id text,
  closer_sequifi_employee_id text,

  sequifi_sale_id text unique,
  terros_account_id text unique,

  market text,
  team text,
  region text,
  division text,
  dealer_name text,
  office_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_project_id_idx on projects (project_id);
create index if not exists projects_email_idx on projects (lower(email));
create index if not exists projects_phone_idx on projects (phone);
create index if not exists projects_updated_at_idx on projects (updated_at desc);
create index if not exists projects_terros_account_id_idx on projects (terros_account_id);

alter table projects enable row level security;

drop policy if exists "projects_select_authenticated" on projects;
create policy "projects_select_authenticated" on projects
  for select to authenticated using (true);

create or replace function set_projects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function set_projects_updated_at();
