-- Fetch only the latest remittance row per project (by payment_date).

create or replace function latest_remittance_for_projects(project_ids uuid[])
returns setof remittance
language sql
stable
as $$
  select distinct on (r.project_id) r.*
  from remittance r
  where r.project_id = any (project_ids)
  order by r.project_id, r.payment_date desc nulls last;
$$;

grant execute on function latest_remittance_for_projects(uuid[]) to authenticated;
grant execute on function latest_remittance_for_projects(uuid[]) to service_role;

create index if not exists remittance_project_id_payment_date_idx
  on remittance (project_id, payment_date desc nulls last);
