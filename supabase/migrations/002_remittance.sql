-- Weekly remittance snapshots (one row per project per payment date / file row).
-- Links to the live `projects` table by hes_code → project_id.

create table if not exists remittance (
  id bigint generated always as identity primary key,
  project_id uuid references projects(id) on delete set null,

  payment_date date not null,
  hes_code text not null,
  customer_name text,
  sales_partner text,
  sales_advisor text,
  channel text,
  status text,

  latest_contract text,
  contract_date date,
  finance_type text,
  financier text,
  utility_provider text,

  pv_size numeric,
  redline_price_tier numeric,
  contract_amount numeric,
  gross_ppw numeric,
  finance_fee numeric,
  cash_deal_value numeric,
  battery_price numeric,
  adder_amount numeric,
  contract_adder_detail text,
  post_sale_adder_work_order numeric,
  post_sale_adders numeric,
  pv_only_price numeric,
  ppw numeric,

  down_payment numeric,
  spif numeric,
  tpo_rebate numeric,
  etqa numeric,
  enfin_dca numeric,
  light_reach_dca numeric,

  partner_commission numeric,
  partner_incentive numeric,
  re_payment numeric,

  c0 numeric,
  c1 numeric,
  c2 numeric,
  adjusted_c2 numeric,

  c0_paid numeric,
  c1_paid numeric,
  c2_paid numeric,
  incentive_paid numeric,
  clawback numeric,
  others numeric,
  total_sp_paid numeric,
  payment_this_week numeric,

  file_name text not null,
  file_hash text not null,
  row_number int not null,
  raw_row jsonb not null,
  imported_at timestamptz not null default now(),

  unique (file_hash, row_number)
);

create index if not exists remittance_hes_code_idx on remittance (hes_code);
create index if not exists remittance_project_id_idx on remittance (project_id);
create index if not exists remittance_payment_date_idx on remittance (payment_date desc);

alter table remittance enable row level security;

drop policy if exists "remittance_select_authenticated" on remittance;
create policy "remittance_select_authenticated" on remittance
  for select to authenticated using (true);
