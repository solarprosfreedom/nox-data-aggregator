-- Add installer field to projects table and backfill existing rows.
alter table projects add column if not exists installer text;

-- Backfill all existing rows with Axia Solar Corp
update projects set installer = 'Axia Solar Corp' where installer is null;

create index if not exists projects_installer_idx on projects (installer);
