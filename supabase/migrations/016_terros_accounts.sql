-- Terros Account webhooks (POST /api/webhooks/terros) upsert here for project matching.
create table if not exists terros_accounts (
  account_id text primary key,
  opportunity_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  address_line1 text,
  postal_code text,
  setter_name text,
  setter_email text,
  closer_name text,
  raw_terros jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists terros_accounts_email_idx on terros_accounts (lower(email));
create index if not exists terros_accounts_updated_at_idx on terros_accounts (updated_at desc);
