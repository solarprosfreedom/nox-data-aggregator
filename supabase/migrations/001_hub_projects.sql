-- Unified project records (SSOT for deals / installs).
-- Run against the same Supabase project as nox-crm.

create table if not exists hub_projects (
  id uuid primary key default gen_random_uuid(),

  hes_id text not null unique,

  opportunity_name text,
  first_name text,
  last_name text,
  address_line1 text,
  city text,
  state_code text,
  postal_code text,
  email text,
  phone text,
  sales_advisor_name text,
  sales_advisor_email text,
  project_stage text,
  contract_signed_date date,
  total_system_cost numeric,
  system_size_kw numeric,

  tape_record_id bigint unique,
  pid text unique,
  job_status text,
  ntp_app_status text,
  pipeline_stage text,
  has_install boolean not null default false,
  install_completed_date date,
  sale_date date,
  cancel_date date,
  setter_name text,
  setter_email text,
  closer_name text,
  closer_2_name text,
  net_epc numeric,
  sow_amount numeric,
  product_name text,
  dealer_name text,
  office_name text,
  division text,
  region text,
  team text,
  market text,
  notes text,

  terros_account_id text unique,
  enerflo_customer_id text,
  terros_stage text,

  last_remittance_date date,
  remittance_status text,
  total_sp_paid_to_date numeric,

  raw_projects_sheet jsonb,
  raw_tape jsonb,
  raw_terros jsonb,

  last_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_projects_email_idx on hub_projects (lower(email));
create index if not exists hub_projects_phone_idx on hub_projects (phone);
create index if not exists hub_projects_updated_at_idx on hub_projects (updated_at desc);
create index if not exists hub_projects_pipeline_stage_idx on hub_projects (pipeline_stage);

alter table hub_projects enable row level security;

drop policy if exists "hub_projects_select_authenticated" on hub_projects;
create policy "hub_projects_select_authenticated" on hub_projects
  for select to authenticated using (true);
