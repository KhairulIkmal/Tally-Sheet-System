-- Tally Sheet: audit log. Two more events on a sheet, both recorded by the office:
--   viewed     an office user opened the sheet (once per person per 30 minutes,
--              so refreshing doesn't fill the log)
--   reprinted  "Print again" on a sheet already marked printed
-- and an index for reading the log by time.
--
-- Additive: the existing events, policies and RPCs are unchanged.

alter table tally.sheet_events drop constraint sheet_events_event_check;
alter table tally.sheet_events add constraint sheet_events_event_check
  check (event in ('submitted', 'printed', 'unprinted', 'viewed', 'reprinted'));

create index sheet_events_at_idx on tally.sheet_events (at);

create or replace function tally.log_sheet_event(p_sheet_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status tally.sheet_status;
  v_name   text;
begin
  if not tally.is_office() then
    raise exception 'Only the office can do that.' using errcode = 'insufficient_privilege';
  end if;
  if p_event is null or p_event not in ('viewed', 'reprinted') then
    raise exception 'Unknown event.' using errcode = '22023';
  end if;

  select status into v_status from tally.sheets where id = p_sheet_id;
  if not found then
    raise exception 'Sheet not found.' using errcode = 'no_data_found';
  end if;

  if p_event = 'reprinted' and v_status <> 'printed' then
    raise exception 'Only a sheet marked printed can be printed again.' using errcode = '22023';
  end if;

  -- Opening the same sheet again soon after is the same visit.
  if p_event = 'viewed' and exists (
    select 1 from tally.sheet_events
    where sheet_id = p_sheet_id and event = 'viewed' and actor_id = auth.uid() and at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();
  insert into tally.sheet_events (sheet_id, event, actor_id, actor_name) values (p_sheet_id, p_event, auth.uid(), v_name);
end;
$$;

revoke all on function tally.log_sheet_event(uuid, text) from public, anon;
grant execute on function tally.log_sheet_event(uuid, text) to authenticated;
