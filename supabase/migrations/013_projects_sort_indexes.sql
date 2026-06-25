-- Speed up common project table sort columns (6k+ rows).
create index if not exists projects_project_id_sort_idx on projects (project_id);
create index if not exists projects_opportunity_name_sort_idx on projects (opportunity_name);
create index if not exists projects_project_stage_sort_idx on projects (project_stage);
create index if not exists projects_setter_name_sort_idx on projects (setter_name);
create index if not exists projects_contract_signed_date_sort_idx on projects (contract_signed_date);
create index if not exists projects_installer_sort_idx on projects (installer);
