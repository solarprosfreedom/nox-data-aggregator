-- Hub net price per watt (from remittance PPW or calc fallback).
-- Renamed from sequifi_net_epc; hub/remittance is source of truth.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'sequifi_net_epc'
  ) then
    alter table projects rename column sequifi_net_epc to net_epc;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'net_epc'
  ) then
    alter table projects add column net_epc numeric;
  end if;
end $$;
