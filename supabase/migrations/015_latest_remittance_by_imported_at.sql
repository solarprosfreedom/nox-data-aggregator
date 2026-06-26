-- Latest remittance per project = most recently imported row, not payment_date.

create or replace function latest_remittance_for_projects(project_ids uuid[])
returns setof remittance
language sql
stable
as $$
  select distinct on (r.project_id) r.*
  from remittance r
  where r.project_id = any (project_ids)
  order by r.project_id, r.imported_at desc nulls last, r.id desc;
$$;

create index if not exists remittance_project_id_imported_at_idx
  on remittance (project_id, imported_at desc nulls last);
