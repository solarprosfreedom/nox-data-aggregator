-- Which apps each user may open after login (shared with nox-crm).

create table if not exists user_app_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  app_slug text not null check (app_slug in ('nox-crm', 'nox-data-hub')),
  created_at timestamptz not null default now(),
  primary key (user_id, app_slug)
);

alter table user_app_access enable row level security;

drop policy if exists "user_app_access_select_own" on user_app_access;
create policy "user_app_access_select_own" on user_app_access
  for select using (auth.uid() = user_id);

-- Grant existing CRM users access to both apps.
insert into user_app_access (user_id, app_slug)
select id, 'nox-crm' from profiles
on conflict do nothing;

insert into user_app_access (user_id, app_slug)
select id, 'nox-data-hub' from profiles
on conflict do nothing;

create index if not exists user_app_access_user_id_idx on user_app_access (user_id);
