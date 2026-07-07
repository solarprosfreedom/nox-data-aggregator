-- Stores raw Coperniq outbound webhook payloads plus best-effort normalized fields.
create table if not exists coperniq_webhooks (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),

  event_id text,
  record_id text,
  record_uid text,
  record_type text,
  trigger_key text,
  trigger_name text,
  fired_at timestamptz,
  work_order_id text,

  project_id text,
  customer_name text,
  customer_email text,
  address text,
  city text,
  state_code text,
  postal_code text,
  system_size_kw numeric,
  contract_signed_date date,
  total_system_cost numeric,
  project_stage text,
  install_date date,
  setter_name text,
  setter_email text,
  sales_rep_name text,
  sales_rep_email text,
  gross_ppw numeric,
  net_ppw numeric,
  adders numeric,
  finance_type text,

  raw_body text not null,
  raw_payload jsonb not null,
  request_headers jsonb
);

create index if not exists coperniq_webhooks_received_at_idx
  on coperniq_webhooks (received_at desc);
create index if not exists coperniq_webhooks_event_id_idx
  on coperniq_webhooks (event_id);
create index if not exists coperniq_webhooks_project_id_idx
  on coperniq_webhooks (project_id);
create index if not exists coperniq_webhooks_customer_email_idx
  on coperniq_webhooks (lower(customer_email));
